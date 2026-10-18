// Tipos compartidos entre las fuentes externas (services/fuentes) y los módulos.

/** Fuentes que vienen programadas en services/fuentes (no se pueden borrar, solo desactivar). */
export type FuenteIntegrada = 'dane' | 'osm' | 'rnt' | 'secop' | 'reps';

export const FUENTES_INTEGRADAS: readonly FuenteIntegrada[] = ['dane', 'osm', 'rnt', 'secop', 'reps'];
/** @deprecated usa FUENTES_INTEGRADAS */
export const FUENTES = FUENTES_INTEGRADAS;

/**
 * Clave de una fuente: una integrada o una agregada por el equipo desde /api/fuentes
 * (minúsculas, números y guion bajo; ej. "camara_comercio_cali").
 */
export type NombreFuente = string;

export const PATRON_CLAVE_FUENTE = /^[a-z][a-z0-9_]{1,29}$/;

export const esFuenteIntegrada = (clave: string): clave is FuenteIntegrada => (FUENTES_INTEGRADAS as readonly string[]).includes(clave);

export interface Telefono {
  /** +57 y 10 dígitos */
  numero: string;
  tipo: 'movil' | 'fijo';
  whatsapp?: boolean;
}

/** Un negocio tal como lo entrega una fuente, ya normalizado. */
export interface Candidato {
  fuente: NombreFuente;
  /** Identificador estable dentro de la fuente (NIT, id de OSM, código RNT...) */
  idExterno: string;
  nombre: string | null;
  razonSocial: string | null;
  nombreComercial: string | null;
  nit: string | null;
  codMpio: string;
  direccion: string | null;
  lat: number | null;
  lon: number | null;
  ciiu: string | null;
  /** Clasificación propia de la fuente: "shop=hardware", "CIIU 4752", "RNT HOTEL"... */
  categoriaFuente: string | null;
  telefonos: Telefono[];
  emails: string[];
  sitiosWeb: string[];
  redes: string[];
  /** true si la fuente indica que es una persona natural; null si no se sabe */
  esPersonaNatural: boolean | null;
  crudo: unknown;
}

/** Qué pedirle a cada fuente en una búsqueda. */
export interface FiltroFuente {
  /** false = la categoría no tiene equivalente en esta fuente y no se consulta */
  aplica: boolean;
  /** Valores propios de la fuente (etiquetas OSM, CIIU, categorías RNT, prefijos UNSPSC). Vacío = sin filtro. */
  valores: string[];
}

export interface FiltrosBusqueda {
  categoria: string | null;
  nombre: string;
  todos: boolean;
  incluirPersonasNaturales: boolean;
  porFuente: Record<NombreFuente, FiltroFuente>;
}

export interface ResultadoFuente {
  candidatos: Candidato[];
  meta?: Record<string, unknown>;
}

/** Contrato que implementa cada fuente en services/fuentes. */
export interface FuenteLeads {
  nombre: NombreFuente;
  descripcion: string;
  /** Cambia cuando cambia la configuración de la fuente (invalida la caché). */
  version?: string;
  buscar(municipio: Municipio, filtro: FiltroFuente, opciones: { incluirPersonasNaturales: boolean }): Promise<ResultadoFuente>;
}

export interface Municipio {
  codigo: string;
  nombre: string;
  tipo: string;
  codigoDepartamento: string;
  departamento: string;
  lat: number;
  lon: number;
}
