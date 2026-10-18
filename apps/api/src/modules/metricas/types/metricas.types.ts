import type { CanalCosto } from 'modules/costos/types/costos.types';

export type CanalMetrica = 'email' | 'whatsapp' | 'llamada' | 'dapta';

export interface PeriodoDTO {
  /** AAAA-MM-DD, inclusive (calendario de Colombia). */
  desde: string;
  hasta: string;
  dias: number;
}

/** Conteos crudos que salen de la base. "indiceSuma" = suma del índice de calidad de los calificados. */
export interface ConteoEmbudoDTO {
  contactados: number;
  respondieron: number;
  interesados: number;
  calificados: number;
  alta: number;
  indiceSuma: number;
}

export interface DatosFuenteDTO extends ConteoEmbudoDTO {
  fuente: string;
  leads: number;
  contactables: number;
}

export interface DatosCanalDTO extends ConteoEmbudoDTO {
  canal: CanalMetrica;
  /** Mensajes, llamadas o envíos a Dapta que salieron. */
  contactos: number;
}

/** Leads distintos contactados por cada canal, según la fuente que los trajo (para repartir el costo del canal). */
export interface ContactosPorFuenteDTO {
  canal: CanalMetrica;
  fuente: string;
  leads: number;
}

export interface CostoPeriodoDTO {
  canal: CanalCosto;
  monto: number;
  desde: string;
  hasta: string;
}

export interface CostoDesgloseDTO {
  /** Cargado directo a la fuente. */
  directo: number;
  /** Parte de los costos "general", según cuántos leads trajo la fuente. */
  general: number;
  /** Parte del costo de contactar (correo, WhatsApp, llamadas, Dapta), según cuántos de sus leads se contactaron por cada canal. */
  contacto: number;
  total: number;
}

export interface IndicadoresDTO {
  /** respondieron / contactados (0–1). */
  tasaRespuesta: number | null;
  /** Promedio 0–100 de los calificados (puntaje, o ALTA 85 · MEDIA 60 · BAJA 30 · DESCARTADO 0). */
  indiceCalidad: number | null;
  /** alta / calificados (0–1). */
  tasaAlta: number | null;
  costoPorRespuesta: number | null;
  costoPorLeadAlta: number | null;
}

export interface MetricaFuenteDTO extends DatosFuenteDTO, IndicadoresDTO {
  costo: CostoDesgloseDTO;
  /** Costo por lead: costo total / leads. */
  cpl: number | null;
}

export interface MetricaCanalDTO extends DatosCanalDTO, IndicadoresDTO {
  /** Leads distintos contactados por el canal. */
  leadsContactados: number;
  costo: number;
  /** Costo por lead contactado. */
  costoPorContacto: number | null;
}

export interface MetricasDTO {
  periodo: PeriodoDTO;
  totales: {
    leads: number;
    contactados: number;
    respondieron: number;
    calificados: number;
    alta: number;
    costoTotal: number;
    /** Costos que no se pudieron repartir (ej. un canal sin contactos en el periodo). */
    costoSinAsignar: number;
    cpl: number | null;
    costoPorRespuesta: number | null;
    costoPorLeadAlta: number | null;
    indiceCalidad: number | null;
  };
  porFuente: MetricaFuenteDTO[];
  porCanal: MetricaCanalDTO[];
  /** Costo del periodo por canal de costo (ya prorrateado). */
  costos: Partial<Record<CanalCosto, number>>;
}
