// Lead qualification with Dapta (point 4).
//
// Flow: the platform sends the lead to a Flow Studio flow (POST to its Public Route) with a
// "reference". The flow qualifies it (usually by calling it with a voice agent) and sends the
// result to POST /api/dapta/webhook with that reference. Meanwhile it stays SENT.
//
// If the flow calls the lead (DAPTA_CALLS=true), the dispatch counts as a call: the same rules
// as any contact apply (do not contact, owner, Ley 2300) and it is recorded in the history.

import { randomUUID, timingSafeEqual } from 'node:crypto';
import * as realRepository from '../repository/qualifications.repository';
import { environment } from '~config/environment';
import { CATEGORIES } from '~config/catalog/categories';
import { AppError, HttpCode } from '~response/index';
import { DaptaSendError, sendToDapta as sendReal, daptaMode as realMode } from '~services/dapta';
import type { SessionUser } from '~types/auth.types';
import { OutreachDomain } from 'modules/outreach/domain/outreach.domain';
import type { QualificationsDomainInterface } from './qualifications.interface';
import { normalizeDaptaResult } from './qualifications.webhook';
import type {
  QualificationDTO,
  QualifyManuallyDTO,
  DaptaStatusDTO,
  LeadForDaptaDTO,
  BatchSendResultDTO,
} from '../types/qualifications.types';

export type QualificationsRepository = typeof realRepository;
type Outreach = Pick<OutreachDomain, 'requireContactPermission' | 'recordExternalCall' | 'recordExternalReply'>;

export interface QualificationsDependencies {
  repo: QualificationsRepository;
  outreach: Outreach;
  dapta: { sendToDapta: typeof sendReal; daptaMode: typeof realMode };
  now: () => Date;
  newReference: () => string;
  config: { contacts: boolean; webhookSecret: string | undefined; publicUrl: string | undefined; apiPrefix: string };
}

const byDefault = (): QualificationsDependencies => ({
  repo: realRepository,
  outreach: new OutreachDomain(),
  dapta: { sendToDapta: sendReal, daptaMode: realMode },
  now: () => new Date(),
  newReference: () => randomUUID(),
  config: {
    contacts: environment.dapta.contacts,
    webhookSecret: environment.dapta.webhookSecret,
    publicUrl: environment.publicUrl,
    apiPrefix: environment.apiPrefix,
  },
});

export const MAX_BATCH = 100;
const MAX_WAIT_MS = 72 * 3600_000;

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Phone for the Dapta call: WhatsApp/mobile first. Dapta requires the +57… format */
function phoneForDapta(lead: LeadForDaptaDTO): string | null {
  const t = lead.phones.find((x) => x.whatsapp) ?? lead.phones.find((x) => x.type === 'mobile') ?? lead.phones[0];
  return t?.number.startsWith('+') ? t.number : null;
}

export class QualificationsDomain implements QualificationsDomainInterface {
  private readonly d: QualificationsDependencies;

  constructor(deps: Partial<QualificationsDependencies> = {}) {
    this.d = { ...byDefault(), ...deps };
  }

  status(): DaptaStatusDTO {
    const { publicUrl, apiPrefix, webhookSecret, contacts } = this.d.config;
    return {
      mode: this.d.dapta.daptaMode(),
      contacts,
      webhook: Boolean(webhookSecret),
      urlWebhook: publicUrl ? `${publicUrl}${apiPrefix}/dapta/webhook` : null,
    };
  }

  async list(leadId: number): Promise<QualificationDTO[]> {
    await this.lead(leadId);
    return this.d.repo.findQualifications(leadId);
  }

  async send(leadId: number, user: SessionUser): Promise<QualificationDTO> {
    if (this.d.dapta.daptaMode() === 'disabled') {
      throw new AppError(HttpCode.SERVICE_UNAVAILABLE, 'La integración con Dapta no está configurada en el servidor (falta DAPTA_FLOW_URL).');
    }
    const lead = await this.lead(leadId);
    if (lead.doNotContact) throw new AppError(HttpCode.CONFLICT, 'Este lead pidió no volver a ser contactado.');
    // A dispatch without a result stops blocking after 72 h (the flow may have failed silently).
    const pending = await this.d.repo.findPendingDispatch(leadId, new Date(this.d.now().getTime() - MAX_WAIT_MS));
    if (pending) {
      throw new AppError(HttpCode.CONFLICT, 'Este lead ya está en Dapta esperando su calificación.', { sentAt: pending.createdAt });
    }
    const phone = phoneForDapta(lead);
    if (this.d.config.contacts) {
      if (!phone) throw new AppError(HttpCode.UNPROCESSABLE_ENTITY, 'No tiene un teléfono al que Dapta pueda llamar.', { rule: 'channel' });
      // A call by the Dapta agent is a call: same rules as if the team made it.
      await this.d.outreach.requireContactPermission(leadId, user, 'CALL');
    } else if (lead.contactedById && lead.contactedById !== user.id && user.role !== 'ADMIN') {
      throw new AppError(HttpCode.CONFLICT, `Este lead lo está trabajando ${lead.contactedBy?.fullName ?? 'otra persona del equipo'}.`);
    }

    const reference = this.d.newReference();
    const base = {
      leadId, userId: user.id, origin: 'DAPTA' as const, reference, quality: null, score: null, summary: null,
      variables: null, callId: null, qualifiedAt: null,
    };
    try {
      const r = await this.d.dapta.sendToDapta({
        reference,
        lead_id: lead.id,
        contact_name: lead.name,
        contact_phone: phone,
        contact_email: lead.emails[0] ?? null,
        municipality: lead.municipality,
        department: lead.department,
        category: lead.categories.map((c) => CATEGORIES[c]?.name).find(Boolean) ?? null,
        source: lead.originSource,
        contact_status: lead.contactStatus,
        callback_url: this.status().urlWebhook,
      });
      const created = await this.d.repo.createQualification({ ...base, status: r.status, error: null });
      if (this.d.config.contacts) {
        const simulated = r.status === 'SIMULATED' ? ' (simulado: no salió)' : '';
        await this.d.outreach.recordExternalCall(leadId, user, `Llamada del agente de Dapta${simulated}.`);
      }
      return created;
    } catch (err) {
      if (!(err instanceof DaptaSendError)) throw err;
      await this.d.repo.createQualification({ ...base, status: 'FAILED', error: err.message });
      throw new AppError(HttpCode.BAD_GATEWAY, err.message);
    }
  }

  async sendBatch(leadIds: number[], user: SessionUser): Promise<BatchSendResultDTO> {
    const ids = [...new Set(leadIds)];
    if (ids.length > MAX_BATCH) throw new AppError(HttpCode.BAD_REQUEST, `Máximo ${MAX_BATCH} leads por envío.`);
    const results: BatchSendResultDTO['results'] = [];
    // One at a time: each dispatch must see what the previous one left, and Dapta rate-limits.
    for (const leadId of ids) {
      try {
        await this.send(leadId, user);
        results.push({ leadId, ok: true, reason: null });
      } catch (err) {
        if (!(err instanceof AppError)) throw err;
        // If Dapta is down or not configured, there is no point continuing with the rest.
        if (err.status === HttpCode.SERVICE_UNAVAILABLE) throw err;
        results.push({ leadId, ok: false, reason: err.message });
      }
    }
    const sent = results.filter((r) => r.ok).length;
    return { sent, skipped: results.length - sent, results };
  }

  async receiveResult(body: Record<string, unknown>, secret: string | undefined): Promise<QualificationDTO> {
    const expected = this.d.config.webhookSecret;
    if (!expected) throw new AppError(HttpCode.SERVICE_UNAVAILABLE, 'El webhook de Dapta no está configurado (falta DAPTA_WEBHOOK_SECRET).');
    if (!secret || !sameSecret(secret, expected)) throw new AppError(HttpCode.UNAUTHORIZED, 'Secreto inválido.');

    const r = normalizeDaptaResult(body);
    const dispatch = r.reference
      ? await this.d.repo.findQualificationByReference(r.reference)
      : await this.d.repo.findPendingDispatch(r.leadId!);
    if (!dispatch || dispatch.origin !== 'DAPTA') throw new AppError(HttpCode.NOT_FOUND, 'No hay un envío a Dapta con esa referencia.');
    if (r.leadId && r.leadId !== dispatch.leadId) throw new AppError(HttpCode.BAD_REQUEST, 'La referencia no corresponde a ese lead.');
    if (!r.quality && !r.noContact) {
      throw new AppError(HttpCode.BAD_REQUEST, 'El resultado no trae calificación: manda "quality" (high, medium, low, discarded) o "score" (0 a 100).');
    }

    const now = this.d.now();
    const saved = await this.d.repo.saveResult(dispatch.id, {
      status: r.quality ? 'QUALIFIED' : 'NO_CONTACT',
      quality: r.quality,
      score: r.score,
      summary: r.summary,
      variables: r.variables,
      callId: r.callId,
      error: null,
      qualifiedAt: r.quality ? now : null,
    });
    // If the agent talked to the lead, the lead replied: the funnel advances.
    if (this.d.config.contacts && r.quality && r.quality !== 'DISCARDED') {
      const note = `Habló con el agente de Dapta${r.summary ? `: ${r.summary}` : '.'}`.slice(0, 1000);
      await this.d.outreach.recordExternalReply(dispatch.leadId, r.quality === 'HIGH' ? 'INTERESTED' : 'REPLIED', note);
    }
    return saved;
  }

  async qualifyManually(leadId: number, dto: QualifyManuallyDTO, user: SessionUser): Promise<QualificationDTO> {
    const lead = await this.lead(leadId);
    if (lead.contactedById && lead.contactedById !== user.id && user.role !== 'ADMIN') {
      throw new AppError(HttpCode.CONFLICT, `Este lead lo está trabajando ${lead.contactedBy?.fullName ?? 'otra persona del equipo'}.`);
    }
    return this.d.repo.createManualQualification({
      leadId, userId: user.id, origin: 'MANUAL', status: 'QUALIFIED', reference: this.d.newReference(),
      quality: dto.quality, score: dto.score ?? null, summary: dto.note?.trim() || null, variables: null, callId: null,
      error: null, qualifiedAt: this.d.now(),
    });
  }

  private async lead(id: number): Promise<LeadForDaptaDTO> {
    const lead = await this.d.repo.findLeadForDapta(id);
    if (!lead) throw new AppError(HttpCode.NOT_FOUND, 'Lead no encontrado.');
    return lead;
  }
}
