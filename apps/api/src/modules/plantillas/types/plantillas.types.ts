export const CANALES_PLANTILLA = ['EMAIL', 'WHATSAPP', 'LLAMADA'] as const;
export type CanalPlantilla = (typeof CANALES_PLANTILLA)[number];

export interface PlantillaDTO {
  id: number;
  nombre: string;
  canal: CanalPlantilla;
  /** Solo correo. */
  asunto: string | null;
  cuerpo: string;
  activa: boolean;
  creadoPorId: number | null;
  creadoPor?: { id: number; fullName: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlantillaDTO {
  nombre: string;
  canal: CanalPlantilla;
  asunto?: string | null;
  cuerpo: string;
  creadoPorId: number | null;
}

export type UpdatePlantillaDTO = Partial<Pick<PlantillaDTO, 'nombre' | 'asunto' | 'cuerpo' | 'activa'>>;

export interface FiltrosPlantillasDTO {
  canal?: CanalPlantilla;
  incluirInactivas?: boolean;
}

/** Valores con los que se rellenan las variables {{...}} de una plantilla. */
export interface VariablesPlantilla {
  nombre: string;
  municipio: string;
  departamento: string;
  categoria: string;
  remitente: string;
  empresa: string;
}
