import type { ModoCorreo } from '~services/correo';
import type { Telefono } from '~types/fuente.types';

export const ESTADOS_CONTACTO = ['PENDIENTE', 'CONTACTADO', 'RESPONDIO', 'INTERESADO', 'NO_INTERESADO', 'REBOTADO'] as const;
export type EstadoContacto = (typeof ESTADOS_CONTACTO)[number];

/** Cómo puede quedar un lead al registrar su respuesta. */
export const RESULTADOS_RESPUESTA = ['RESPONDIO', 'INTERESADO', 'NO_INTERESADO', 'REBOTADO'] as const;
export type ResultadoRespuesta = (typeof RESULTADOS_RESPUESTA)[number];

export const CANALES = ['EMAIL', 'WHATSAPP', 'LLAMADA', 'OTRO', 'DAPTA'] as const;
export type CanalContacto = (typeof CANALES)[number];

/** Canales que se registran a mano (el correo sale desde la plataforma). */
export const CANALES_MANUALES = ['WHATSAPP', 'LLAMADA', 'OTRO'] as const;
export type CanalManual = (typeof CANALES_MANUALES)[number];

export type SentidoInteraccion = 'SALIENTE' | 'ENTRANTE';
export type EstadoInteraccion = 'ENVIADO' | 'SIMULADO' | 'FALLIDO' | 'REGISTRADO';

export interface InteraccionDTO {
  id: number;
  leadId: number;
  usuarioId: number | null;
  usuario?: { id: number; fullName: string } | null;
  canal: CanalContacto;
  sentido: SentidoInteraccion;
  estado: EstadoInteraccion;
  destino: string | null;
  asunto: string | null;
  mensaje: string | null;
  nota: string | null;
  resultado: EstadoContacto | null;
  error: string | null;
  proveedorId: string | null;
  plantillaId: number | null;
  createdAt: Date;
}

export type CreateInteraccionDTO = Omit<InteraccionDTO, 'id' | 'usuario' | 'createdAt'>;

/** Lo que el módulo necesita saber del lead para contactarlo. */
export interface LeadContactoDTO {
  id: number;
  nombre: string;
  municipio: string;
  departamento: string;
  categorias: string[];
  telefonos: Telefono[];
  emails: string[];
  contactado: boolean;
  contactadoEn: Date | null;
  contactadoPorId: number | null;
  contactadoPor: { id: number; fullName: string; email: string } | null;
  estadoContacto: EstadoContacto;
  ultimoContactoEn: Date | null;
  respondioEn: Date | null;
  noContactar: boolean;
  noContactarEn: Date | null;
  /** Última calificación (Dapta o manual). */
  calidad: 'ALTA' | 'MEDIA' | 'BAJA' | 'DESCARTADO' | null;
  puntaje: number | null;
  calificadoEn: Date | null;
}

/** Salida previa (para las reglas de horario y frecuencia). */
export interface SalidaPreviaDTO {
  canal: CanalContacto;
  createdAt: Date;
}

export type CanalConPermiso = 'EMAIL' | 'WHATSAPP' | 'LLAMADA';

export interface PermisoContactoDTO {
  /** null = se puede; si no, por qué no (mismo motivo para todos los canales). */
  motivo: string | null;
  /** Motivo por canal (ej. sin correo registrado), además del general. */
  porCanal: Record<CanalConPermiso, string | null>;
}

export interface FichaContactoDTO {
  lead: LeadContactoDTO;
  interacciones: InteraccionDTO[];
  /** Datos de contacto disponibles por canal. */
  canales: { email: string[]; whatsapp: string[]; telefono: string[] };
  permiso: PermisoContactoDTO;
  correo: { modo: ModoCorreo };
  horarioLegal: boolean;
}

export interface EnviarCorreoDTO {
  para?: string;
  asunto: string;
  mensaje: string;
  plantillaId?: number;
}

export interface RegistrarContactoDTO {
  canal: CanalManual;
  destino?: string;
  mensaje?: string;
  nota?: string;
  plantillaId?: number;
}

export interface RegistrarRespuestaDTO {
  canal: CanalContacto;
  resultado: ResultadoRespuesta;
  nota?: string;
}

export interface VistaPreviaDTO {
  plantillaId?: number;
  asunto?: string;
  cuerpo?: string;
}

export interface MensajePreparadoDTO {
  asunto: string | null;
  mensaje: string;
  /** Pie legal que se agrega a los correos (identificación y cómo darse de baja). */
  pie: string;
}

export interface ResultadoContactoDTO {
  interaccion: InteraccionDTO;
  lead: LeadContactoDTO;
}
