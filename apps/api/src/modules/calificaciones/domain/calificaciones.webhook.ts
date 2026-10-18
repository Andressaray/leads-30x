// Normaliza lo que manda el flujo de Dapta. Como el formato lo arma quien configura el flujo
// (Dapta no fija un esquema), se aceptan los nombres de campo más comunes en español e inglés.
import { AppError, HttpCode } from '~response/index';
import type { CalidadLead, ResultadoDaptaDTO } from '../types/calificaciones.types';

const SINONIMOS: Record<CalidadLead, string[]> = {
  ALTA: ['alta', 'alto', 'high', 'hot', 'caliente', 'a', 'calificado', 'qualified'],
  MEDIA: ['media', 'medio', 'medium', 'warm', 'tibio', 'b'],
  BAJA: ['baja', 'bajo', 'low', 'cold', 'frio', 'c'],
  DESCARTADO: ['descartado', 'descartada', 'discarded', 'disqualified', 'no_calificado', 'not_qualified', 'no aplica', 'd'],
};

const SIN_CONTACTO = /no.?answer|no.?contest|voicemail|buz[oó]n|busy|ocupad|failed|fall[oó]|invalid|errado|unreachable/i;

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Puntaje → calidad cuando el flujo solo manda número. */
export function calidadDePuntaje(puntaje: number): CalidadLead {
  if (puntaje >= 70) return 'ALTA';
  if (puntaje >= 40) return 'MEDIA';
  return 'BAJA';
}

export function normalizarResultadoDapta(body: Record<string, unknown>): ResultadoDaptaDTO {
  const lead = (body.lead ?? {}) as Record<string, unknown>;
  const referencia = texto(body.referencia) ?? texto(body.reference) ?? texto(body.ref) ?? undefined;
  const idCrudo = body.lead_id ?? body.leadId ?? lead.id;
  const leadId = idCrudo !== undefined && /^\d+$/.test(String(idCrudo)) ? Number(idCrudo) : undefined;
  if (!referencia && !leadId) throw new AppError(HttpCode.BAD_REQUEST, 'Falta "referencia" (o "lead_id") para saber de qué lead es el resultado.');

  let puntaje: number | null = null;
  const pCrudo = body.puntaje ?? body.score ?? body.lead_score;
  if (pCrudo !== undefined && pCrudo !== null && pCrudo !== '') {
    const n = Number(pCrudo);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw new AppError(HttpCode.BAD_REQUEST, 'El puntaje debe ser un número de 0 a 100.');
    puntaje = Math.round(n);
  }

  let calidad: CalidadLead | null = null;
  const cCrudo = texto(body.calidad) ?? texto(body.calificacion) ?? texto(body.qualification) ?? texto(body.lead_quality);
  if (cCrudo) {
    const c = sinTildes(cCrudo);
    calidad = (Object.keys(SINONIMOS) as CalidadLead[]).find((k) => SINONIMOS[k].includes(c)) ?? null;
    if (!calidad) {
      throw new AppError(HttpCode.BAD_REQUEST, `Calificación desconocida: "${cCrudo}". Usa alta, media, baja o descartado (o un puntaje de 0 a 100).`);
    }
  }
  if (!calidad && puntaje !== null) calidad = calidadDePuntaje(puntaje);

  const estadoLlamada = texto(body.estado_llamada) ?? texto(body.call_status) ?? texto(body.status) ?? '';
  const variables = body.variables && typeof body.variables === 'object' ? body.variables : null;
  return {
    referencia,
    leadId,
    calidad,
    puntaje,
    resumen: texto(body.resumen) ?? texto(body.call_summary) ?? texto(body.summary),
    variables,
    llamadaId: texto(body.call_id) ?? texto(body.llamada_id) ?? (typeof body.call_id === 'number' ? String(body.call_id) : null),
    sinContacto: !calidad && SIN_CONTACTO.test(estadoLlamada),
  };
}
