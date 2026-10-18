import type { SearchDTO, CreateSearchRequestDTO, SearchStartDTO, SearchResultDTO } from '../types/searches.types';

export interface SearchesDomainInterface {
  /** Searches leads in the sources for a city, deduplicates them and stores them. */
  create(dto: CreateSearchRequestDTO): Promise<SearchResultDTO>;
  /** Same as create, but responds right away and processes in the background. */
  start(dto: CreateSearchRequestDTO): Promise<SearchStartDTO>;
  /** Search history, most recent first. */
  list(limit: number): Promise<SearchDTO[]>;
  /** A search with the detail per source. Throws 404 if it does not exist. */
  get(id: number): Promise<SearchDTO>;
}
