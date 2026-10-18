import type { ModoDapta } from '~services/dapta';

export const CALIDADES = ['ALTA', 'MEDIA', 'BAJA', 'DESCARTADO'] as const;
export type CalidadLead = (typeof CALIDADES)[number];
export type OrigenCalificacion = 'DAPTA' | 'MANUAL';
export type EstadoCalificacion = 'ENVIADO' | 'SIMULADO' | 'FALLIDO' | 'CALIFICADO' | 'SIN_CONTACTO';

export interface CalificacionDTO {
  id: number;
  leadId: number;
  usuarioId: number | null;
  usuario?: { id: number; fullName: string } | null;
  origen: OrigenCalificacion;
  estado: EstadoCalificacion;
  referencia: string;
  calidad: CalidadLead | null;
  puntaje: number | null;
  resumen: string | null;
  variables: unknown;
  llamadaId: string | null;
  error: string | null;
  calificadoEn: Date | null;
  createdAt: Date;
}

export type CreateCalificacionDTO = Omit<CalificacionDTO, 'id' | 'usuario' | 'createdAt'>;
export type ResultadoCalificacionDTO = Pick<CalificacionDTO, 'estado' | 'calidad' | 'puntaje' | 'resumen' | 'variables' | 'llamadaId' | 'error' | 'calificadoEn'>;

/** Lo que el módulo necesita del lead para mandarlo a Dapta. */
export interface LeadParaDaptaDTO {
  id: number;
  nombre: string;
  municipio: string;
  departamento: string;
  categorias: string[];
  telefonos: { numero: string; tipo: 'movil' | 'fijo'; whatsapp?: boolean }[];
  emails: string[];
  fuenteOrigen: string;
  estadoContacto: string;
  noContactar: boolean;
  contactadoPorId: number | null;
  contactadoPor: { id: number; fullName: string } | null;
}

export interface EstadoDaptaDTO {
  modo: ModoDapta;
  /** El flujo llama al lead: aplican las reglas de contacto (Ley 2300). */
  contacta: boolean;
  /** Hay secreto configurado: el webhook acepta resultados. */
  webhook: boolean;
  /** URL a configurar en el flujo de Dapta (null sin URL_PUBLICA). */
  urlWebhook: string | null;
}

export interface ResultadoEnvioLoteDTO {
  enviados: number;
  omitidos: number;
  resultados: { leadId: number; ok: boolean; motivo: string | null }[];
}

/** Webhook de Dapta ya normalizado (el flujo puede usar varios nombres de campo). */
export interface ResultadoDaptaDTO {
  referencia?: string;
  leadId?: number;
  calidad: CalidadLead | null;
  puntaje: number | null;
  resumen: string | null;
  variables: unknown;
  llamadaId: string | null;
  /** No hubo conversación (no contestó, buzón, número errado). */
  sinContacto: boolean;
}

export interface CalificarManualDTO {
  calidad: CalidadLead;
  puntaje?: number;
  nota?: string;
}
