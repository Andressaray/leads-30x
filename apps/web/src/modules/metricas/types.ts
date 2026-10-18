export type CanalMetrica = "email" | "whatsapp" | "llamada" | "dapta";
export type CanalCosto = "dane" | "osm" | "rnt" | "secop" | "reps" | CanalMetrica | "general";

export interface Indicadores {
  tasaRespuesta: number | null;
  indiceCalidad: number | null;
  tasaAlta: number | null;
  costoPorRespuesta: number | null;
  costoPorLeadAlta: number | null;
}

interface Embudo {
  contactados: number;
  respondieron: number;
  interesados: number;
  calificados: number;
  alta: number;
}

export interface MetricaFuente extends Embudo, Indicadores {
  fuente: string;
  leads: number;
  contactables: number;
  costo: { directo: number; general: number; contacto: number; total: number };
  cpl: number | null;
}

export interface MetricaCanal extends Embudo, Indicadores {
  canal: CanalMetrica;
  contactos: number;
  leadsContactados: number;
  costo: number;
  costoPorContacto: number | null;
}

export interface Metricas {
  periodo: { desde: string; hasta: string; dias: number };
  totales: {
    leads: number;
    contactados: number;
    respondieron: number;
    calificados: number;
    alta: number;
    costoTotal: number;
    costoSinAsignar: number;
    cpl: number | null;
    costoPorRespuesta: number | null;
    costoPorLeadAlta: number | null;
    indiceCalidad: number | null;
  };
  porFuente: MetricaFuente[];
  porCanal: MetricaCanal[];
  costos: Partial<Record<CanalCosto, number>>;
}

export interface Costo {
  id: number;
  canal: CanalCosto;
  tipo: "GASTO" | "HORAS";
  descripcion: string;
  monto: number;
  horas: number | null;
  valorHora: number | null;
  desde: string;
  hasta: string;
  creadoPor?: { id: number; fullName: string } | null;
}

export type NuevoCosto = Omit<Costo, "id" | "creadoPor" | "monto" | "horas" | "valorHora"> & {
  monto?: number;
  horas?: number;
  valorHora?: number;
};
