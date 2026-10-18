// Search data access. One function per query, no business rules.

import { prisma, type Prisma } from '~config/db/client';
import type { SearchFilters, SourceName } from '~types/source.types';
import type { SearchDTO, SearchSourceDTO, CreateSearchDTO, SearchStatus, SearchSummaryDTO } from '../types/searches.types';

type SearchRow = Prisma.SearchGetPayload<{ include: { sources: true } }> | Prisma.SearchGetPayload<object>;
type SourceRow = Prisma.SearchSourceGetPayload<object>;

function toSourceDTO(f: SourceRow): SearchSourceDTO {
  return {
    source: f.source as SourceName,
    status: f.status as SearchSourceDTO['status'],
    records: f.records,
    new: f.new,
    enriched: f.enriched,
    unchanged: f.unchanged,
    skipped: f.skipped,
    durationMs: f.durationMs,
    error: f.error,
    meta: (f.meta as Record<string, unknown> | null) ?? null,
  };
}

function toSearchDTO(b: SearchRow): SearchDTO {
  const { sources, ...rest } = b as SearchRow & { sources?: SourceRow[] };
  return {
    ...rest,
    filters: rest.filters as unknown as SearchFilters,
    requestedSources: (rest.requestedSources ?? []) as SourceName[],
    status: rest.status as SearchStatus,
    summary: (rest.summary as unknown as SearchSummaryDTO | null) ?? null,
    ...(sources ? { sources: sources.map(toSourceDTO) } : {}),
  };
}

export async function createSearch(dto: CreateSearchDTO): Promise<SearchDTO> {
  const row = await prisma.search.create({
    data: { ...dto, filters: dto.filters as unknown as Prisma.InputJsonValue },
  });
  return toSearchDTO(row);
}

export async function upsertSearchSource(searchId: number, f: SearchSourceDTO): Promise<void> {
  const data = { ...f, meta: (f.meta ?? undefined) as Prisma.InputJsonValue | undefined };
  await prisma.searchSource.upsert({
    where: { searchId_source: { searchId, source: f.source } },
    create: { searchId, ...data },
    update: data,
  });
}

export async function updateSearch(id: number, data: { status: SearchStatus; summary: SearchSummaryDTO; finishedAt: Date }): Promise<SearchDTO> {
  const row = await prisma.search.update({
    where: { id },
    data: { ...data, summary: data.summary as unknown as Prisma.InputJsonValue },
  });
  return toSearchDTO(row);
}

export async function findSearches(limit: number): Promise<SearchDTO[]> {
  const rows = await prisma.search.findMany({ orderBy: { id: 'desc' }, take: limit });
  return rows.map(toSearchDTO);
}

export async function findSearchById(id: number): Promise<SearchDTO | null> {
  const row = await prisma.search.findUnique({ where: { id }, include: { sources: { orderBy: { source: 'asc' } } } });
  return row ? toSearchDTO(row) : null;
}

/** At startup: searches left "in_progress" (the server stopped midway) become "failed". */
export async function closeUnfinishedSearches(): Promise<number> {
  const r = await prisma.search.updateMany({ where: { status: 'in_progress' }, data: { status: 'failed', finishedAt: new Date() } });
  return r.count;
}
