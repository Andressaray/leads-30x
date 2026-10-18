// Normalizes what the Dapta flow sends. Whoever configures the flow decides the format
// (Dapta does not enforce a schema), so the most common field names are accepted in both
// English and Spanish (the Spanish names are data here, not code).
import { AppError, HttpCode } from '~response/index';
import type { LeadQuality, DaptaResultDTO } from '../types/qualifications.types';

const SYNONYMS: Record<LeadQuality, string[]> = {
  HIGH: ['high', 'hot', 'qualified', 'a', 'alta', 'alto', 'caliente', 'calificado'],
  MEDIUM: ['medium', 'warm', 'b', 'media', 'medio', 'tibio'],
  LOW: ['low', 'cold', 'c', 'baja', 'bajo', 'frio'],
  DISCARDED: ['discarded', 'disqualified', 'not_qualified', 'd', 'descartado', 'descartada', 'no_calificado', 'no aplica'],
};

const NO_CONTACT = /no.?answer|no.?contest|voicemail|buz[oó]n|busy|ocupad|failed|fall[oó]|invalid|errado|unreachable/i;

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Score → quality when the flow only sends a number. */
export function qualityFromScore(score: number): LeadQuality {
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

export function normalizeDaptaResult(body: Record<string, unknown>): DaptaResultDTO {
  const lead = (body.lead ?? {}) as Record<string, unknown>;
  const reference = text(body.reference) ?? text(body.referencia) ?? text(body.ref) ?? undefined;
  const rawId = body.lead_id ?? body.leadId ?? lead.id;
  const leadId = rawId !== undefined && /^\d+$/.test(String(rawId)) ? Number(rawId) : undefined;
  if (!reference && !leadId) throw new AppError(HttpCode.BAD_REQUEST, 'Falta "reference" (o "lead_id") para saber de qué lead es el resultado.');

  let score: number | null = null;
  const rawScore = body.score ?? body.puntaje ?? body.lead_score;
  if (rawScore !== undefined && rawScore !== null && rawScore !== '') {
    const n = Number(rawScore);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw new AppError(HttpCode.BAD_REQUEST, 'El puntaje debe ser un número de 0 a 100.');
    score = Math.round(n);
  }

  let quality: LeadQuality | null = null;
  const rawQuality = text(body.quality) ?? text(body.qualification) ?? text(body.lead_quality) ?? text(body.calidad) ?? text(body.calificacion);
  if (rawQuality) {
    const q = stripAccents(rawQuality);
    quality = (Object.keys(SYNONYMS) as LeadQuality[]).find((k) => SYNONYMS[k].includes(q)) ?? null;
    if (!quality) {
      throw new AppError(HttpCode.BAD_REQUEST, `Calificación desconocida: "${rawQuality}". Usa high, medium, low o discarded (también alta, media, baja o descartado) o un puntaje de 0 a 100.`);
    }
  }
  if (!quality && score !== null) quality = qualityFromScore(score);

  const callStatus = text(body.call_status) ?? text(body.estado_llamada) ?? text(body.status) ?? '';
  const variables = body.variables && typeof body.variables === 'object' ? body.variables : null;
  return {
    reference,
    leadId,
    quality,
    score,
    summary: text(body.summary) ?? text(body.call_summary) ?? text(body.resumen),
    variables,
    callId: text(body.call_id) ?? text(body.llamada_id) ?? (typeof body.call_id === 'number' ? String(body.call_id) : null),
    noContact: !quality && NO_CONTACT.test(callStatus),
  };
}
