import type { Lead, NombreFuente } from "@/modules/leads";

/** Lo que el formulario envía a POST /api/busquedas. */
export interface CrearBusqueda {
  codigo: string;
  categoria?: string;
  /** true = ignora la caché de la API y vuelve a consultar las fuentes */
  refrescar?: boolean;
}

/** Respuesta 202 de POST /api/busquedas con asincrona: true. */
export interface InicioBusqueda {
  busquedaId: number;
  estado: "en_curso";
  enCola: number;
}

/** GET /api/busquedas/:id (solo los campos que usa la web). */
export interface BusquedaGuardada {
  id: number;
  codMpio: string;
  municipio: string;
  departamento: string;
  filtros: { nombre: string; categoria: string | null };
  estado: "en_curso" | "completa" | "parcial" | "fallida";
  resumen: ResumenBusqueda | null;
}

export type EstadoFuente = "ok" | "error" | "omitida";

export interface ResumenFuente {
  estado: EstadoFuente;
  registros: number;
  nuevos: number;
  enriquecidos: number;
  error: string | null;
}

export interface ResumenBusqueda {
  leads: number;
  nuevos: number;
  contactables: number;
  enVariasFuentes: number;
  porFuente: Partial<Record<NombreFuente, ResumenFuente>>;
}

export interface ResultadoBusqueda {
  busquedaId: number;
  estado: "en_curso" | "completa" | "parcial" | "fallida";
  municipio: { codigo: string; nombre: string; departamento: string };
  filtros: { nombre: string; categoria: string | null };
  resumen: ResumenBusqueda;
  leadsTotal: number;
  leads: Lead[];
}

/** 409: el nombre de la ciudad es ambiguo. */
export interface CandidatoMunicipio {
  nombre: string;
  departamento: string;
}
