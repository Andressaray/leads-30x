// In-memory searches repository, with the same signature as the real one.

import type { SearchesRepository } from 'modules/searches/domain/searches.domain';
import type { SearchDTO, SearchSourceDTO, CreateSearchDTO, SearchStatus, SearchSummaryDTO } from 'modules/searches/types/searches.types';

export interface InMemorySearchesRepository extends SearchesRepository {
  _status: { searches: SearchDTO[] };
}

export function createInMemorySearchesRepository(): InMemorySearchesRepository {
  const searches: SearchDTO[] = [];
  let nextId = 1;
  const byId = (id: number) => searches.find((b) => b.id === id);

  const repo = {
    _status: { searches },
    async createSearch(dto: CreateSearchDTO) {
      const now = new Date();
      const b: SearchDTO = { ...dto, id: nextId++, status: 'in_progress', summary: null, finishedAt: null, createdAt: now, updatedAt: now, sources: [] };
      searches.push(b);
      return structuredClone(b);
    },
    async upsertSearchSource(searchId: number, f: SearchSourceDTO) {
      const b = byId(searchId)!;
      b.sources = [...(b.sources ?? []).filter((x) => x.source !== f.source), f];
    },
    async updateSearch(id: number, data: { status: SearchStatus; summary: SearchSummaryDTO; finishedAt: Date }) {
      const b = byId(id)!;
      Object.assign(b, data, { updatedAt: new Date() });
      return structuredClone(b);
    },
    async closeUnfinishedSearches() {
      const open = searches.filter((b) => b.status === 'in_progress');
      for (const b of open) Object.assign(b, { status: 'failed', finishedAt: new Date() });
      return open.length;
    },
    async findSearches(limit: number) {
      return [...searches].reverse().slice(0, limit).map((b) => structuredClone(b));
    },
    async findSearchById(id: number) {
      const b = byId(id);
      return b ? structuredClone(b) : null;
    },
  };
  return repo as unknown as InMemorySearchesRepository;
}
