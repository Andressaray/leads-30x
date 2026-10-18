import type { Lead, SourceName } from "@/modules/leads";

/** What the form sends to POST /api/searches. */
export interface CreateSearch {
  code: string;
  category?: string;
  /** true = ignores the API cache and queries the sources again */
  refresh?: boolean;
}

/** 202 response of POST /api/searches with async: true. */
export interface SearchStart {
  searchId: number;
  status: "in_progress";
  queued: number;
}

/** GET /api/searches/:id (only the fields the web app uses). */
export interface SavedSearch {
  id: number;
  municipalityCode: string;
  municipality: string;
  department: string;
  filters: { name: string; category: string | null };
  status: "in_progress" | "complete" | "partial" | "failed";
  summary: SearchSummary | null;
}

export type SourceStatus = "ok" | "error" | "skipped";

export interface SourceSummary {
  status: SourceStatus;
  records: number;
  new: number;
  enriched: number;
  error: string | null;
}

export interface SearchSummary {
  leads: number;
  new: number;
  contactables: number;
  inMultipleSources: number;
  bySource: Partial<Record<SourceName, SourceSummary>>;
}

export interface SearchResult {
  searchId: number;
  status: "in_progress" | "complete" | "partial" | "failed";
  municipality: { code: string; name: string; department: string };
  filters: { name: string; category: string | null };
  summary: SearchSummary;
  leadsTotal: number;
  leads: Lead[];
}

/** 409: the city name is ambiguous. */
export interface MunicipalityCandidate {
  name: string;
  department: string;
}
