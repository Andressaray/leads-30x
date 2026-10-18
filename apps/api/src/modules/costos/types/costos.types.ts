import { FUENTES } from '~types/fuente.types';

/** Canales de contacto que generan costo (el correo, WhatsApp, las llamadas y Dapta). */
export const CANALES_CONTACTO_COSTO = ['email', 'whatsapp', 'llamada', 'dapta'] as const;
/** A qué se carga un costo: una fuente (dónde se encontró el lead), un canal de contacto, o "general". */
export const CANALES_COSTO = [...FUENTES, ...CANALES_CONTACTO_COSTO, 'general'] as const;
export type CanalCosto = (typeof CANALES_COSTO)[number];
export type TipoCosto = 'GASTO' | 'HORAS';

export interface CostoDTO {
  id: number;
  canal: CanalCosto;
  tipo: TipoCosto;
  descripcion: string;
  /** Pesos colombianos. */
  monto: number;
  horas: number | null;
  valorHora: number | null;
  /** AAAA-MM-DD, inclusive. */
  desde: string;
  hasta: string;
  creadoPorId: number | null;
  creadoPor?: { id: number; fullName: string } | null;
  createdAt: Date;
}

export interface CreateCostoDTO {
  canal: CanalCosto;
  tipo: TipoCosto;
  descripcion: string;
  monto?: number;
  horas?: number;
  valorHora?: number;
  desde: string;
  hasta: string;
}

export type UpdateCostoDTO = Partial<CreateCostoDTO>;

/** Lo que se guarda (ya con el monto calculado). */
export interface DatosCostoDTO {
  canal: CanalCosto;
  tipo: TipoCosto;
  descripcion: string;
  monto: number;
  horas: number | null;
  valorHora: number | null;
  desde: string;
  hasta: string;
  creadoPorId?: number | null;
}
