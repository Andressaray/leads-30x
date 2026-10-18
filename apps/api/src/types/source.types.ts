// Types shared between the external sources (services/sources) and the modules.

/** Sources coded in services/sources (they cannot be deleted, only disabled). */
export type BuiltInSource = 'dane' | 'osm' | 'rnt' | 'secop' | 'reps';

export const BUILT_IN_SOURCES: readonly BuiltInSource[] = ['dane', 'osm', 'rnt', 'secop', 'reps'];
/** @deprecated use BUILT_IN_SOURCES */
export const SOURCES = BUILT_IN_SOURCES;

/**
 * Key of a source: a built-in one or one added by the team from /api/sources
 * (lowercase letters, numbers and underscore; e.g. "camara_comercio_cali").
 */
export type SourceName = string;

export const SOURCE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,29}$/;

export const isBuiltInSource = (key: string): key is BuiltInSource => (BUILT_IN_SOURCES as readonly string[]).includes(key);

export interface Phone {
  /** +57 and 10 digits */
  number: string;
  type: 'mobile' | 'landline';
  whatsapp?: boolean;
}

/** A business as a source delivers it, already normalized. */
export interface Candidate {
  source: SourceName;
  /** Stable identifier within the source (NIT, OSM id, RNT code...) */
  externalId: string;
  name: string | null;
  legalName: string | null;
  tradeName: string | null;
  nit: string | null;
  municipalityCode: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
  ciiu: string | null;
  /** The source's own classification: "shop=hardware", "CIIU 4752", "RNT HOTEL"... */
  sourceCategory: string | null;
  phones: Phone[];
  emails: string[];
  websites: string[];
  socialLinks: string[];
  /** true if the source says it is an individual; null if unknown */
  isIndividual: boolean | null;
  raw: unknown;
}

/** What to ask each source in a search. */
export interface SourceFilter {
  /** false = the category has no equivalent in this source and it is not queried */
  applies: boolean;
  /** The source's own values (OSM tags, CIIU, RNT categories, UNSPSC prefixes). Empty = no filter. */
  values: string[];
}

export interface SearchFilters {
  category: string | null;
  name: string;
  all: boolean;
  includeIndividuals: boolean;
  bySource: Record<SourceName, SourceFilter>;
}

export interface SourceResult {
  candidates: Candidate[];
  meta?: Record<string, unknown>;
}

/** Contract each source in services/sources implements. */
export interface LeadSource {
  name: SourceName;
  description: string;
  /** Changes when the source configuration changes (invalidates the cache). */
  version?: string;
  search(municipality: Municipality, filter: SourceFilter, options: { includeIndividuals: boolean }): Promise<SourceResult>;
}

export interface Municipality {
  code: string;
  name: string;
  type: string;
  departmentCode: string;
  department: string;
  lat: number;
  lon: number;
}
