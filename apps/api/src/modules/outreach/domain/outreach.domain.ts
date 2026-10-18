// Rules to contact leads from the platform:
//   - Emails go out through SMTP; WhatsApp messages and calls happen outside and are recorded here.
//   - Never contact someone who asked not to receive more messages, nor someone who said they are not interested.
//   - A lead is worked by a single person (the first one who contacted it); an ADMIN can step in.
//   - Ley 2300 de 2023 (unless CONTACT_LEGAL_HOURS is false), while the lead has not replied:
//       · only Monday to Friday 7 a.m.–7 p.m. and Saturdays 8 a.m.–3 p.m., no Sundays or holidays;
//       · at most one contact per day;
//       · within the same week, a single channel.
//     Once the lead replies, the lead asked for the conversation and these rules no longer limit it.

import * as realRepository from '../repository/outreach.repository';
import { environment } from '~config/environment';
import { AppError, HttpCode } from '~response/index';
import { EmailSendError, sendEmail as sendRealEmail, emailMode as realEmailMode } from '~services/mail';
import type { SessionUser } from '~types/auth.types';
import { colombiaWeekStart, sameDayColombia, outsideHoursReason } from '~utils/contactHours';
import { createUnsubscribeToken, readUnsubscribeToken } from '~utils/unsubscribeToken';
import { TemplatesDomain } from 'modules/templates/domain/templates.domain';
import { capitalize, capitalizeName, render, unknownVariables, VARIABLES } from 'modules/templates/domain/templates.render';
import { CATEGORIES } from '~config/catalog/categories';
import type { OutreachDomainInterface } from './outreach.interface';
import type {
  ChannelWithPermission,
  ContactChannel,
  CreateInteractionDTO,
  SendEmailDTO,
  ContactSheetDTO,
  LeadContactDTO,
  PreparedMessageDTO,
  ContactPermissionDTO,
  RecordContactDTO,
  RecordReplyDTO,
  ContactResultDTO,
  PreviousOutboundDTO,
  PreviewDTO,
} from '../types/outreach.types';

export type OutreachRepository = typeof realRepository;

export interface OutreachDependencies {
  repo: OutreachRepository;
  templates: Pick<TemplatesDomain, 'get'>;
  email: { sendEmail: typeof sendRealEmail; emailMode: typeof realEmailMode };
  now: () => Date;
  config: {
    legalHours: boolean;
    companyName: string;
    publicUrl: string | undefined;
    apiPrefix: string;
    secret: string;
    replyTo: string | undefined;
  };
}

const byDefault = (): OutreachDependencies => ({
  repo: realRepository,
  templates: new TemplatesDomain(),
  email: { sendEmail: sendRealEmail, emailMode: realEmailMode },
  now: () => new Date(),
  config: {
    legalHours: environment.legalHours,
    companyName: environment.companyName,
    publicUrl: environment.publicUrl,
    apiPrefix: environment.apiPrefix,
    secret: environment.jwtSecret,
    replyTo: environment.email.replyTo,
  },
});

const CHANNEL_NAME: Record<ContactChannel, string> = {
  EMAIL: 'correo', WHATSAPP: 'WhatsApp', CALL: 'llamada', OTHER: 'otro canal', DAPTA: 'llamada del agente de Dapta',
};
/** For the "one channel per week" rule, a Dapta call is a call. */
const legalChannel = (c: ContactChannel): ContactChannel => (c === 'DAPTA' ? 'CALL' : c);
const CONVERSATION_STATUSES = new Set(['REPLIED', 'INTERESTED']);

/** To compare numbers with or without the country code: "+57 300 111 2233" and "3001112233" are the same. */
const sameNumber = (a: string, b: string) => {
  const n = (s: string) => s.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
  return n(a).length >= 7 && n(a) === n(b);
};

/** WhatsApp numbers: the ones marked as such and, if there are none, the mobile numbers. */
function whatsappNumbers(lead: LeadContactDTO): string[] {
  const marked = lead.phones.filter((t) => t.whatsapp).map((t) => t.number);
  return marked.length ? marked : lead.phones.filter((t) => t.type === 'mobile').map((t) => t.number);
}

function hour(date: Date): string {
  return date.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' });
}

export class OutreachDomain implements OutreachDomainInterface {
  private readonly d: OutreachDependencies;

  constructor(deps: Partial<OutreachDependencies> = {}) {
    this.d = { ...byDefault(), ...deps };
  }

  async sheet(leadId: number, user: SessionUser): Promise<ContactSheetDTO> {
    const lead = await this.lead(leadId);
    const [interactions, permission] = await Promise.all([this.d.repo.findInteractions(leadId), this.permission(lead, user)]);
    return {
      lead,
      interactions,
      channels: { email: lead.emails, whatsapp: whatsappNumbers(lead), phone: lead.phones.map((t) => t.number) },
      permission,
      email: { mode: this.d.email.emailMode() },
      legalHours: this.d.config.legalHours,
    };
  }

  async preview(leadId: number, dto: PreviewDTO, user: SessionUser): Promise<PreparedMessageDTO> {
    const lead = await this.lead(leadId);
    let subject = dto.subject ?? null;
    let body = dto.body ?? '';
    if (dto.templateId) {
      const p = await this.d.templates.get(dto.templateId);
      subject = p.subject;
      body = p.body;
    }
    const bad = unknownVariables(`${subject ?? ''} ${body}`);
    if (bad.length) {
      throw new AppError(HttpCode.BAD_REQUEST, `Variable desconocida: ${bad.map((m) => `{{${m}}}`).join(', ')}.`, { unknown: bad });
    }
    const vars = this.variables(lead, user);
    return { subject: subject === null ? null : render(subject, vars), message: render(body, vars), footer: this.emailFooter(lead.id, user).text };
  }

  async sendEmail(leadId: number, dto: SendEmailDTO, user: SessionUser): Promise<ContactResultDTO> {
    const lead = await this.lead(leadId);
    await this.requirePermission(lead, user, 'EMAIL');
    const to = dto.to?.trim().toLowerCase() ?? lead.emails[0];
    if (!lead.emails.some((e) => e.toLowerCase() === to)) {
      throw new AppError(HttpCode.BAD_REQUEST, 'Ese correo no es de este lead. Elige uno de sus correos.', { field: 'to' });
    }
    this.withoutLooseVariables(dto.subject, dto.message);

    const footer = this.emailFooter(lead.id, user);
    const base: CreateInteractionDTO = {
      leadId: lead.id, userId: user.id, channel: 'EMAIL', direction: 'OUTBOUND', status: 'SENT', destination: to,
      subject: dto.subject, message: dto.message, note: null, result: null, error: null, providerId: null,
      templateId: dto.templateId ?? null,
    };
    try {
      const r = await this.d.email.sendEmail({
        to,
        subject: dto.subject,
        text: `${dto.message}\n\n--\n${footer.text}`,
        replyTo: this.d.config.replyTo ?? user.email,
        unsubscribeUrl: footer.url,
      });
      const interaction = await this.d.repo.saveOutbound({ ...base, status: r.status, providerId: r.providerId }, this.d.now());
      return { interaction, lead: await this.lead(leadId) };
    } catch (err) {
      if (!(err instanceof EmailSendError)) throw err;
      await this.d.repo.createInteraction({ ...base, status: 'FAILED', error: err.message });
      throw new AppError(HttpCode.BAD_GATEWAY, `No se pudo enviar el correo. ${err.message}`);
    }
  }

  async recordContact(leadId: number, dto: RecordContactDTO, user: SessionUser): Promise<ContactResultDTO> {
    const lead = await this.lead(leadId);
    const channelPermission: ChannelWithPermission | null = dto.channel === 'OTHER' ? null : dto.channel;
    await this.requirePermission(lead, user, channelPermission);
    let destination: string | null = dto.destination?.trim() || null;
    if (dto.channel !== 'OTHER') {
      const possibleMatches = dto.channel === 'WHATSAPP' ? whatsappNumbers(lead) : lead.phones.map((t) => t.number);
      destination = destination ? (possibleMatches.find((n) => sameNumber(n, destination!)) ?? null) : possibleMatches[0];
      if (!destination) throw new AppError(HttpCode.BAD_REQUEST, 'Ese número no es de este lead. Elige uno de sus números.', { field: 'destination' });
    }
    const interaction = await this.d.repo.saveOutbound(
      {
        leadId: lead.id, userId: user.id, channel: dto.channel, direction: 'OUTBOUND', status: 'RECORDED', destination,
        subject: null, message: dto.message?.trim() || null, note: dto.note?.trim() || null, result: null, error: null,
        providerId: null, templateId: dto.templateId ?? null,
      },
      this.d.now()
    );
    return { interaction, lead: await this.lead(leadId) };
  }

  async recordReply(leadId: number, dto: RecordReplyDTO, user: SessionUser): Promise<ContactResultDTO> {
    const lead = await this.lead(leadId);
    if (lead.contactStatus === 'PENDING') {
      throw new AppError(HttpCode.CONFLICT, 'Todavía no se ha contactado a este lead: primero registra el mensaje o la llamada.');
    }
    this.requireOwner(lead, user);
    const interaction = await this.d.repo.saveReply(
      {
        leadId: lead.id, userId: user.id, channel: dto.channel, direction: 'INBOUND', status: 'RECORDED', destination: null,
        subject: null, message: null, note: dto.note?.trim() || null, result: dto.result, error: null, providerId: null,
        templateId: null,
      },
      dto.result,
      this.d.now()
    );
    return { interaction, lead: await this.lead(leadId) };
  }

  async markDoNotContact(leadId: number, note: string | undefined, user: SessionUser): Promise<LeadContactDTO> {
    const lead = await this.lead(leadId);
    await this.d.repo.markDoNotContact(
      {
        leadId: lead.id, userId: user.id, channel: 'OTHER', direction: 'INBOUND', status: 'RECORDED', destination: null,
        subject: null, message: null, note: note?.trim() || 'Pidió no volver a ser contactado.', result: null, error: null,
        providerId: null, templateId: null,
      },
      this.d.now()
    );
    return this.lead(leadId);
  }

  async unsubscribe(token: string): Promise<{ name: string }> {
    const leadId = readUnsubscribeToken(token, this.d.config.secret);
    const lead = leadId ? await this.d.repo.findLeadContact(leadId) : null;
    if (!lead) throw new AppError(HttpCode.NOT_FOUND, 'El enlace no es válido.');
    await this.d.repo.markDoNotContact(
      {
        leadId: lead.id, userId: null, channel: 'EMAIL', direction: 'INBOUND', status: 'RECORDED', destination: null, subject: null,
        message: null, note: 'Se dio de baja con el enlace del correo.', result: null, error: null, providerId: null, templateId: null,
      },
      this.d.now()
    );
    return { name: lead.name };
  }

  // --- For other modules (Dapta): contacts made by an external system ------------------------

  async requireContactPermission(leadId: number, user: SessionUser, channel: ChannelWithPermission): Promise<LeadContactDTO> {
    const lead = await this.lead(leadId);
    await this.requirePermission(lead, user, channel);
    return lead;
  }

  async recordExternalCall(leadId: number, user: SessionUser, note: string): Promise<void> {
    const lead = await this.lead(leadId);
    const destination = lead.phones.find((t) => t.type === 'mobile')?.number ?? lead.phones[0]?.number ?? null;
    await this.d.repo.saveOutbound(
      {
        leadId, userId: user.id, channel: 'DAPTA', direction: 'OUTBOUND', status: 'RECORDED', destination, subject: null,
        message: null, note, result: null, error: null, providerId: null, templateId: null,
      },
      this.d.now()
    );
  }

  /** Reply reported by an external system. It only advances the funnel: it never moves back a lead that already replied. */
  async recordExternalReply(leadId: number, result: 'REPLIED' | 'INTERESTED', note: string): Promise<void> {
    const lead = await this.lead(leadId);
    const advances = lead.contactStatus === 'PENDING' || lead.contactStatus === 'CONTACTED' || (lead.contactStatus === 'REPLIED' && result === 'INTERESTED');
    if (!advances) return;
    await this.d.repo.saveReply(
      {
        leadId, userId: null, channel: 'DAPTA', direction: 'INBOUND', status: 'RECORDED', destination: null, subject: null,
        message: null, note, result, error: null, providerId: null, templateId: null,
      },
      result,
      this.d.now()
    );
  }

  // ---------------------------------------------------------------------------------------------

  private async lead(id: number): Promise<LeadContactDTO> {
    const lead = await this.d.repo.findLeadContact(id);
    if (!lead) throw new AppError(HttpCode.NOT_FOUND, 'Lead no encontrado.');
    return lead;
  }

  private requireOwner(lead: LeadContactDTO, user: SessionUser): void {
    const reason = this.ownerReason(lead, user);
    if (reason) throw new AppError(HttpCode.CONFLICT, reason, { contactedBy: lead.contactedBy });
  }

  private ownerReason(lead: LeadContactDTO, user: SessionUser): string | null {
    if (!lead.contactedById || lead.contactedById === user.id || user.role === 'ADMIN') return null;
    return `Este lead lo está trabajando ${lead.contactedBy?.fullName ?? 'otra persona del equipo'}.`;
  }

  /** General reason (applies to every channel) and reason per channel. */
  private async permission(lead: LeadContactDTO, user: SessionUser): Promise<ContactPermissionDTO> {
    const now = this.d.now();
    let reason: string | null = null;
    let previousOutbound: PreviousOutboundDTO[] = [];
    if (lead.doNotContact) reason = 'Pidió no volver a ser contactado.';
    else if (lead.contactStatus === 'NOT_INTERESTED') reason = 'Dijo que no le interesa. Si cambia de opinión, registra su respuesta.';
    else reason = this.ownerReason(lead, user);

    const legalRules = this.d.config.legalHours && !CONVERSATION_STATUSES.has(lead.contactStatus);
    if (!reason && legalRules) {
      reason = outsideHoursReason(now);
      if (!reason) {
        previousOutbound = await this.d.repo.findOutboundSince(lead.id, colombiaWeekStart(now));
        const today = previousOutbound.find((s) => sameDayColombia(s.createdAt, now));
        if (today) {
          reason = `Ya se contactó hoy por ${CHANNEL_NAME[today.channel]} (${hour(today.createdAt)}). La Ley 2300 permite un contacto por día; intenta mañana.`;
        }
      }
    }

    const weekOutbound = legalRules ? previousOutbound.find((s) => s.channel !== 'OTHER') : undefined;
    const weekChannel = weekOutbound ? legalChannel(weekOutbound.channel) : undefined;
    const byChannel = (channel: ChannelWithPermission, noData: string | null): string | null => {
      if (noData) return noData;
      if (weekChannel && weekChannel !== channel) {
        return `Esta semana ya se contactó por ${CHANNEL_NAME[weekChannel]}. La Ley 2300 no permite usar varios canales en la misma semana: sigue por ${CHANNEL_NAME[weekChannel]} o espera al lunes.`;
      }
      return null;
    };
    return {
      reason,
      byChannel: {
        EMAIL: byChannel('EMAIL', lead.emails.length ? null : 'No tiene correo registrado.'),
        WHATSAPP: byChannel('WHATSAPP', whatsappNumbers(lead).length ? null : 'No tiene celular ni WhatsApp registrado.'),
        CALL: byChannel('CALL', lead.phones.length ? null : 'No tiene teléfono registrado.'),
      },
    };
  }

  private async requirePermission(lead: LeadContactDTO, user: SessionUser, channel: ChannelWithPermission | null): Promise<void> {
    if (lead.doNotContact) throw new AppError(HttpCode.CONFLICT, 'Este lead pidió no volver a ser contactado.');
    if (lead.contactStatus === 'NOT_INTERESTED') {
      throw new AppError(HttpCode.CONFLICT, 'Este lead dijo que no le interesa. Si cambia de opinión, registra su respuesta primero.');
    }
    this.requireOwner(lead, user);
    const p = await this.permission(lead, user);
    if (p.reason) throw new AppError(HttpCode.UNPROCESSABLE_ENTITY, p.reason, { rule: 'law_2300' });
    const channelReason = channel ? p.byChannel[channel] : null;
    if (channelReason) throw new AppError(HttpCode.UNPROCESSABLE_ENTITY, channelReason, { rule: 'channel' });
  }

  private withoutLooseVariables(...texts: string[]): void {
    // The message arrives already prepared (preview): if a {{...}} is left, it is a typo.
    const loose = texts.flatMap((t) => [...t.matchAll(/\{\{\s*([^}]*)\s*\}\}/g)].map((m) => m[1].trim()));
    if (loose.length) {
      throw new AppError(
        HttpCode.BAD_REQUEST,
        `El mensaje tiene variables sin reemplazar: ${loose.map((s) => `{{${s}}}`).join(', ')}. Usa la vista previa antes de enviar.`,
        { field: 'message' }
      );
    }
  }

  private variables(lead: LeadContactDTO, user: SessionUser): Record<keyof typeof VARIABLES, string> {
    const category = lead.categories.map((c) => CATEGORIES[c]?.name).find(Boolean);
    return {
      name: capitalizeName(lead.name),
      municipality: capitalize(lead.municipality),
      department: capitalizeName(lead.department),
      category: category ? category.toLocaleLowerCase('es-CO') : 'negocios',
      sender: user.fullName,
      company: this.d.config.companyName,
    };
  }

  /** Identifies the sender and explains how to stop receiving messages (Ley 2300, art. 5). */
  private emailFooter(leadId: number, user: SessionUser): { text: string; url?: string } {
    const { publicUrl, apiPrefix, secret, companyName } = this.d.config;
    const signature = `${user.fullName} · ${companyName}`;
    if (!publicUrl) {
      return { text: `${signature}\nSi no quieres recibir más mensajes nuestros, responde a este correo con la palabra BAJA.` };
    }
    const url = `${publicUrl}${apiPrefix}/unsubscribe/${createUnsubscribeToken(leadId, secret)}`;
    return { text: `${signature}\nSi no quieres recibir más mensajes nuestros, entra aquí: ${url}`, url };
  }
}
