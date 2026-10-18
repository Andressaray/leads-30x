import type { Telefono } from "@/modules/leads";

export type EstadoContacto = "PENDIENTE" | "CONTACTADO" | "RESPONDIO" | "INTERESADO" | "NO_INTERESADO" | "REBOTADO";
export type ResultadoRespuesta = Exclude<EstadoContacto, "PENDIENTE" | "CONTACTADO">;
export type Canal = "EMAIL" | "WHATSAPP" | "LLAMADA" | "OTRO" | "DAPTA";
export type CanalConPermiso = Exclude<Canal, "OTRO" | "DAPTA">;

export interface Interaccion {
  id: number;
  usuario: { id: number; fullName: string } | null;
  canal: Canal;
  sentido: "SALIENTE" | "ENTRANTE";
  estado: "ENVIADO" | "SIMULADO" | "FALLIDO" | "REGISTRADO";
  destino: string | null;
  asunto: string | null;
  mensaje: string | null;
  nota: string | null;
  resultado: EstadoContacto | null;
  error: string | null;
  createdAt: string;
}

export interface LeadContacto {
  id: number;
  nombre: string;
  municipio: string;
  departamento: string;
  telefonos: Telefono[];
  emails: string[];
  contactadoPorId: number | null;
  contactadoPor: { id: number; fullName: string; email: string } | null;
  estadoContacto: EstadoContacto;
  ultimoContactoEn: string | null;
  respondioEn: string | null;
  noContactar: boolean;
  calidad: CalidadLead | null;
  puntaje: number | null;
  calificadoEn: string | null;
}

export type CalidadLead = "ALTA" | "MEDIA" | "BAJA" | "DESCARTADO";

export interface Calificacion {
  id: number;
  usuario: { id: number; fullName: string } | null;
  origen: "DAPTA" | "MANUAL";
  estado: "ENVIADO" | "SIMULADO" | "FALLIDO" | "CALIFICADO" | "SIN_CONTACTO";
  calidad: CalidadLead | null;
  puntaje: number | null;
  resumen: string | null;
  error: string | null;
  calificadoEn: string | null;
  createdAt: string;
}

export interface EstadoDapta {
  modo: "activo" | "simulado" | "desactivado";
  contacta: boolean;
  webhook: boolean;
  urlWebhook: string | null;
}

export interface ResultadoLoteDapta {
  enviados: number;
  omitidos: number;
  resultados: { leadId: number; ok: boolean; motivo: string | null }[];
}

export interface FichaContacto {
  lead: LeadContacto;
  interacciones: Interaccion[];
  canales: { email: string[]; whatsapp: string[]; telefono: string[] };
  permiso: { motivo: string | null; porCanal: Record<CanalConPermiso, string | null> };
  correo: { modo: "smtp" | "simulado" | "desactivado" };
  horarioLegal: boolean;
}

export interface MensajePreparado {
  asunto: string | null;
  mensaje: string;
  pie: string;
}

export interface Plantilla {
  id: number;
  nombre: string;
  canal: CanalConPermiso;
  asunto: string | null;
  cuerpo: string;
  activa: boolean;
  creadoPorId: number | null;
  creadoPor?: { id: number; fullName: string } | null;
}
