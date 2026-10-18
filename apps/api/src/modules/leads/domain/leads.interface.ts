import type { Candidate } from '~types/source.types';
import type {
  RecordCountDTO,
  RecordContextDTO,
  SourceStatsDTO,
  LeadFiltersDTO,
  LeadDetailDTO,
  LeadDTO,
  LeadListDTO,
  SearchLeadsSummaryDTO,
} from '../types/leads.types';

export interface LeadsDomainInterface {
  /** Stored leads, with filters and pagination. */
  list(filters: LeadFiltersDTO): Promise<LeadListDTO>;
  /** A lead with the history of every source that brought it. Throws 404 if it does not exist. */
  get(id: number): Promise<LeadDetailDTO>;
  /**
   * Marks a lead as contacted (first approach) and assigns it to the user.
   * Throws 404 if it does not exist and 409 if someone else already contacted it.
   */
  markContacted(id: number, userId: number): Promise<LeadDTO>;
  /** CSV (with BOM for Excel) of the leads that match the filters. */
  exportCsv(filters: LeadFiltersDTO): Promise<string>;
  /** Deduplicates and stores a source's candidates within a search. */
  registerCandidates(candidates: Candidate[], ctx: RecordContextDTO): Promise<RecordCountDTO>;
  /** Totals of a search: leads, new, contactable, in several sources. */
  searchSummary(searchId: number): Promise<SearchLeadsSummaryDTO>;
  /** Leads, contactable and attributed leads per source (input for the CPL per channel). */
  stats(): Promise<SourceStatsDTO[]>;
}
