// Orchestrates a search: city → DIVIPOLA municipality → sources in parallel →
// deduplication (leads module) → summary.
// To respond quickly: each source has a wait limit, its results
// are cached for a few hours, and the search can run in the background
// (start) while the client polls GET /searches/:id.

import * as realRepository from '../repository/searches.repository';
import { environment } from '~config/environment';
import { logger } from '~config/logger';
import { AppError, HttpCode } from '~response/index';
import { createSources } from '~services/sources';
import type { SourceFilter, SearchFilters, LeadSource, Municipality, SourceName, SourceResult } from '~types/source.types';
import { CacheTtl, withTimeout } from '~utils/cacheTtl';
import { SerialQueue } from '~utils/serialQueue';
import { resolveMunicipality } from '~utils/divipola';
import { LeadsDomain } from 'modules/leads/domain/leads.domain';
import type { LeadsDomainInterface } from 'modules/leads/domain/leads.interface';
import { resolveFilters } from './searches.filters';
import type { SearchesDomainInterface } from './searches.interface';
import type {
  SearchDTO,
  SearchSourceDTO,
  CreateSearchRequestDTO,
  SearchStatus,
  SearchStartDTO,
  SearchResultDTO,
  SearchSummaryDTO,
} from '../types/searches.types';

export type SearchesRepository = typeof realRepository;

/**
 * Order in which results are stored. DANE goes first (NIT anchor),
 * then the registries with contact data and NIT, and OSM last, which matches by
 * proximity and name against everything before it.
 */
export const PROCESS_ORDER: SourceName[] = ['dane', 'rnt', 'reps', 'secop', 'osm'];

export interface SearchesDependencies {
  repo?: SearchesRepository;
  leads?: LeadsDomainInterface;
  sources?: LeadSource[];
  queue?: SerialQueue;
  maxQueued?: number;
  /** Per-source results cache. By default, according to SOURCE_CACHE_MINUTES. */
  cache?: CacheTtl<SourceResult>;
  /** Wait limit per source (ms). By default, SOURCE_MAX_MS. */
  sourceMaxMs?: number;
}

interface SearchPlan {
  dto: CreateSearchRequestDTO;
  municipality: Municipality;
  filters: SearchFilters;
  requested: SourceName[];
}

/** Cache key: same source, same municipality and same filters → same result. */
export function cacheKey(name: SourceName, municipality: Municipality, filter: SourceFilter, includeIndividuals: boolean): string {
  return [name, municipality.code, [...filter.values].sort().join(','), includeIndividuals ? 'pn' : ''].join('|');
}

export class SearchesDomain implements SearchesDomainInterface {
  private readonly repo: SearchesRepository;
  private readonly leads: LeadsDomainInterface;
  private readonly sources: Map<SourceName, LeadSource>;
  private readonly queue: SerialQueue;
  private readonly maxQueued: number;
  private readonly cache: CacheTtl<SourceResult>;
  private readonly sourceMaxMs: number;

  constructor(deps: SearchesDependencies = {}) {
    this.repo = deps.repo ?? realRepository;
    this.leads = deps.leads ?? new LeadsDomain();
    this.sources = new Map((deps.sources ?? createSources(environment)).map((f) => [f.name, f]));
    this.queue = deps.queue ?? new SerialQueue();
    this.maxQueued = deps.maxQueued ?? 5;
    this.cache = deps.cache ?? new CacheTtl<SourceResult>(environment.cache.ttlMs, environment.cache.maxEntries);
    this.sourceMaxMs = deps.sourceMaxMs ?? environment.sourceMaxMs;
  }

  /** Searches and waits for the complete result (it can take a while if a source is slow). */
  async create(dto: CreateSearchRequestDTO): Promise<SearchResultDTO> {
    const plan = this.prepare(dto);
    const search = await this.register(plan);
    return this.queue.run(() => this.process(plan, search.id));
  }

  /**
   * Validates, records the search and leaves it running in the background. Responds
   * right away with the id; progress is checked with get(id) until the
   * status is no longer "in_progress".
   */
  async start(dto: CreateSearchRequestDTO): Promise<SearchStartDTO> {
    const plan = this.prepare(dto);
    const search = await this.register(plan);
    const queued = this.queue.waiting;
    this.queue.run(() => this.process(plan, search.id)).catch(async (error: unknown) => {
      if (error instanceof AppError) return; // it was already stored as failed
      logger.error({ err: (error as Error)?.message, searchId: search.id }, 'The background search failed');
      await this.repo
        .updateSearch(search.id, { status: 'failed', summary: emptySummary({}), finishedAt: new Date() })
        .catch(() => undefined);
    });
    return {
      searchId: search.id,
      status: 'in_progress',
      queued,
      municipality: { code: plan.municipality.code, name: plan.municipality.name, department: plan.municipality.department },
      filters: plan.filters,
    };
  }

  private prepare(dto: CreateSearchRequestDTO): SearchPlan {
    const r = resolveMunicipality({ city: dto.city, department: dto.department, code: dto.code });
    if ('error' in r) throw new AppError(HttpCode.NOT_FOUND, r.error);
    if ('candidates' in r) {
      throw new AppError(
        HttpCode.CONFLICT,
        `Hay ${r.candidates.length} municipios llamados "${dto.city}". Agrega "departamento" o usa "codigo".`,
        { candidates: r.candidates }
      );
    }
    const municipality = r.municipality;
    const filters = resolveFilters(dto);

    const requested = dto.sources?.length ? [...new Set(dto.sources)] : [...this.sources.keys()];
    const unknown = requested.filter((f) => !this.sources.has(f));
    if (unknown.length) {
      throw new AppError(HttpCode.BAD_REQUEST, `Fuente no disponible: ${unknown.join(', ')}.`);
    }
    if (this.queue.waiting >= this.maxQueued) {
      throw new AppError(HttpCode.TOO_MANY_REQUESTS, 'Hay demasiadas búsquedas en cola. Intenta en un momento.');
    }
    return { dto, municipality, filters, requested };
  }

  private register({ dto, municipality, filters, requested }: SearchPlan) {
    return this.repo.createSearch({
      cityText: dto.city ?? null,
      departmentText: dto.department ?? null,
      municipalityCode: municipality.code,
      municipality: municipality.name,
      department: municipality.department,
      category: filters.category,
      filters,
      requestedSources: requested,
    });
  }

  /** Queries a source, using the cache if the same query was made recently. */
  private async querySource(name: SourceName, municipality: Municipality, filter: SourceFilter, filters: SearchFilters, refresh: boolean): Promise<SourceResult> {
    const key = cacheKey(name, municipality, filter, filters.includeIndividuals);
    const saved = refresh ? undefined : this.cache.get(key);
    if (saved) {
      const copy = structuredClone(saved);
      return { ...copy, meta: { ...(copy.meta ?? {}), cache: true } };
    }
    const res = await withTimeout(
      this.sources.get(name)!.search(municipality, filter, { includeIndividuals: filters.includeIndividuals }),
      this.sourceMaxMs,
      `La fuente no respondió en ${Math.round(this.sourceMaxMs / 1000)} s.`
    );
    this.cache.set(key, structuredClone(res));
    return res;
  }

  private async process({ dto, municipality, filters, requested }: SearchPlan, searchId: number): Promise<SearchResultDTO> {
    const search = { id: searchId };

    // Sources are queried in parallel; if one fails, the rest are stored anyway.
    const responses = await Promise.all(
      requested.map(async (name) => {
        const filter = filters.bySource[name];
        if (!filter.applies) return { name, skipped: true as const, ms: 0 };
        const start = Date.now();
        try {
          const res = await this.querySource(name, municipality, filter, filters, dto.refresh === true);
          return { name, res, ms: Date.now() - start };
        } catch (error) {
          logger.warn({ source: name, err: (error as Error).message }, 'The source failed');
          return { name, error: error as Error, ms: Date.now() - start };
        }
      })
    );

    const bySource: Partial<Record<SourceName, SearchSourceDTO>> = {};
    const sorted = [...responses].sort((a, b) => PROCESS_ORDER.indexOf(a.name) - PROCESS_ORDER.indexOf(b.name));
    for (const r of sorted) {
      let result: SearchSourceDTO;
      if ('skipped' in r) {
        result = empty(r.name, 'skipped', { reason: 'La categoría no tiene equivalente en esta fuente' });
      } else if ('error' in r && r.error) {
        result = { ...empty(r.name, 'error'), error: r.error.message, durationMs: r.ms };
      } else {
        const count = await this.leads.registerCandidates(r.res!.candidates, {
          municipality,
          category: filters.category,
          searchId: search.id,
        });
        result = { source: r.name, status: 'ok', ...count, durationMs: r.ms, error: null, meta: r.res!.meta ?? null };
      }
      bySource[r.name] = result;
      await this.repo.upsertSearchSource(search.id, result);
    }

    const queried = Object.values(bySource).filter(
      (f): f is SearchSourceDTO => f !== undefined && f.status !== 'skipped',
    );
    const failed = queried.filter((f) => f.status === 'error').length;
    const status: SearchStatus = failed === 0 ? 'complete' : failed === queried.length ? 'failed' : 'partial';
    const summary: SearchSummaryDTO = { ...(await this.leads.searchSummary(search.id)), bySource };
    await this.repo.updateSearch(search.id, { status, summary, finishedAt: new Date() });

    if (status === 'failed') {
      throw new AppError(HttpCode.BAD_GATEWAY, 'Ninguna fuente respondió. Intenta de nuevo en unos minutos.', {
        searchId: search.id,
        bySource,
      });
    }

    const listing = await this.leads.list({ searchId: search.id, limit: dto.leadsLimit ?? 200, page: 1 });
    return {
      searchId: search.id,
      status,
      municipality: { code: municipality.code, name: municipality.name, department: municipality.department },
      filters,
      summary,
      leadsTotal: listing.total,
      leads: listing.leads,
    };
  }

  async list(limit: number): Promise<SearchDTO[]> {
    return this.repo.findSearches(limit);
  }

  async get(id: number): Promise<SearchDTO> {
    const b = await this.repo.findSearchById(id);
    if (!b) throw new AppError(HttpCode.NOT_FOUND, 'Búsqueda no encontrada.');
    return b;
  }
}

function emptySummary(bySource: SearchSummaryDTO['bySource']): SearchSummaryDTO {
  return { leads: 0, new: 0, contactables: 0, inMultipleSources: 0, bySource };
}

function empty(source: SourceName, status: SearchSourceDTO['status'], meta: Record<string, unknown> | null = null): SearchSourceDTO {
  return { source, status, records: 0, new: 0, enriched: 0, unchanged: 0, skipped: 0, durationMs: null, error: null, meta };
}
