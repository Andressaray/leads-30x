import * as repo from 'modules/searches/repository/searches.repository';
import { describeWithDb, resetDb, prisma } from '../../../setup/db';
import type { SearchFilters } from '~types/source.types';

const filters = { category: 'hotel', name: 'Hoteles', all: false, includeIndividuals: false, bySource: {} } as unknown as SearchFilters;

describeWithDb('searches.repository', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('creates, records sources, finishes and queries', async () => {
    const b = await repo.createSearch({
      cityText: 'Rionegro', departmentText: 'Antioquia', municipalityCode: '05615', municipality: 'RIONEGRO',
      department: 'Antioquia', category: 'hotel', filters, requestedSources: ['dane', 'osm'],
    });
    expect(b).toMatchObject({ status: 'in_progress', requestedSources: ['dane', 'osm'] });

    const source = { source: 'dane' as const, status: 'ok' as const, records: 3, new: 3, enriched: 0, unchanged: 0, skipped: 0, durationMs: 10, error: null, meta: { queries: 1 } };
    await repo.upsertSearchSource(b.id, source);
    await repo.upsertSearchSource(b.id, { ...source, new: 2 });
    const summary = { leads: 3, new: 3, contactables: 0, inMultipleSources: 0, bySource: { dane: source } };
    await repo.updateSearch(b.id, { status: 'complete', summary, finishedAt: new Date() });

    const detail = await repo.findSearchById(b.id);
    expect(detail).toMatchObject({ status: 'complete', summary: { leads: 3 }, filters: { category: 'hotel' } });
    expect(detail?.sources).toEqual([expect.objectContaining({ source: 'dane', new: 2, meta: { queries: 1 } })]);
    expect(await repo.findSearches(10)).toHaveLength(1);
    expect(await repo.findSearchById(999)).toBeNull();
  });
});
