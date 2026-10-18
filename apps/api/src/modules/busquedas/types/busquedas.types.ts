import type { FiltrosBusqueda, NombreFuente } from '~types/fuente.types';
import type { LeadDTO, ResumenBusquedaLeadsDTO } from 'modules/leads/types/leads.types';

/** Lo que envía el cliente para buscar leads. */
export interface CrearBusquedaDTO {
  ciudad?: string;
  departamento?: string;
  codigo?: string;
  categoria?: string;
  ciiu?: string[];
  osm?: string[];
  fuentes?: NombreFuente[];
  incluirPersonasNaturales?: boolean;
  /** Cuántos leads devolver en la respuesta (el resto se consulta en /leads) */
  limiteLeads?: number;
  /** true = ignora la caché y vuelve a consultar todas las fuentes */
  refrescar?: boolean;
}

export type EstadoBusqueda = 'en_curso' | 'completa' | 'parcial' | 'fallida';
export type EstadoFuente = 'ok' | 'error' | 'omitida';

export interface CreateBusquedaDTO {
  ciudadTexto: string | null;
  departamentoTexto: string | null;
  codMpio: string;
  municipio: string;
  departamento: string;
  categoria: string | null;
  filtros: FiltrosBusqueda;
  fuentesPedidas: NombreFuente[];
}

export interface BusquedaFuenteDTO {
  fuente: NombreFuente;
  estado: EstadoFuente;
  registros: number;
  nuevos: number;
  enriquecidos: number;
  sinCambios: number;
  omitidos: number;
  duracionMs: number | null;
  error: string | null;
  meta: Record<string, unknown> | null;
}

export interface ResumenBusquedaDTO extends ResumenBusquedaLeadsDTO {
  porFuente: Partial<Record<NombreFuente, BusquedaFuenteDTO>>;
}

export interface BusquedaDTO {
  id: number;
  ciudadTexto: string | null;
  departamentoTexto: string | null;
  codMpio: string;
  municipio: string;
  departamento: string;
  categoria: string | null;
  filtros: FiltrosBusqueda;
  fuentesPedidas: NombreFuente[];
  estado: EstadoBusqueda;
  resumen: ResumenBusquedaDTO | null;
  terminadoEn: Date | null;
  createdAt: Date;
  updatedAt: Date;
  fuentes?: BusquedaFuenteDTO[];
}

export interface ResultadoBusquedaDTO {
  busquedaId: number;
  estado: EstadoBusqueda;
  municipio: { codigo: string; nombre: string; departamento: string };
  filtros: FiltrosBusqueda;
  resumen: ResumenBusquedaDTO;
  leadsTotal: number;
  leads: LeadDTO[];
}

/** Respuesta inmediata de una búsqueda en segundo plano (POST con asincrona: true). */
export interface InicioBusquedaDTO {
  busquedaId: number;
  estado: 'en_curso';
  /** Búsquedas que había delante en la cola al momento de iniciar */
  enCola: number;
  municipio: { codigo: string; nombre: string; departamento: string };
  filtros: FiltrosBusqueda;
}
