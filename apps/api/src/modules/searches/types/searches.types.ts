import type { SearchFilters, SourceName } from '~types/source.types';
import type { LeadDTO, SearchLeadsSummaryDTO } from 'modules/leads/types/leads.types';

/** What the client sends to search leads. */
export interface CreateSearchRequestDTO {
  city?: string;
  department?: string;
  code?: string;
  category?: string;
  ciiu?: string[];
  osm?: string[];
  sources?: SourceName[];
  includeIndividuals?: boolean;
  /** How many leads to return in the response (the rest are queried in /leads) */
  leadsLimit?: number;
  /** true = ignores the cache and queries every source again */
  refresh?: boolean;
}

export type SearchStatus = 'in_progress' | 'complete' | 'partial' | 'failed';
export type SourceStatus = 'ok' | 'error' | 'skipped';

export interface CreateSearchDTO {
  cityText: string | null;
  departmentText: string | null;
  municipalityCode: string;
  municipality: string;
  department: string;
  category: string | null;
  filters: SearchFilters;
  requestedSources: SourceName[];
}

export interface SearchSourceDTO {
  source: SourceName;
  status: SourceStatus;
  records: number;
  new: number;
  enriched: number;
  unchanged: number;
  skipped: number;
  durationMs: number | null;
  error: string | null;
  meta: Record<string, unknown> | null;
}

export interface SearchSummaryDTO extends SearchLeadsSummaryDTO {
  bySource: Partial<Record<SourceName, SearchSourceDTO>>;
}

export interface SearchDTO {
  id: number;
  cityText: string | null;
  departmentText: string | null;
  municipalityCode: string;
  municipality: string;
  department: string;
  category: string | null;
  filters: SearchFilters;
  requestedSources: SourceName[];
  status: SearchStatus;
  summary: SearchSummaryDTO | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sources?: SearchSourceDTO[];
}

export interface SearchResultDTO {
  searchId: number;
  status: SearchStatus;
  municipality: { code: string; name: string; department: string };
  filters: SearchFilters;
  summary: SearchSummaryDTO;
  leadsTotal: number;
  leads: LeadDTO[];
}

/** Immediate response of a background search (POST with async: true). */
export interface SearchStartDTO {
  searchId: number;
  status: 'in_progress';
  /** Searches that were ahead in the queue when it started */
  queued: number;
  municipality: { code: string; name: string; department: string };
  filters: SearchFilters;
}
