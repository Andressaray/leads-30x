// Tests of the mechanisms that shorten the wait: cache, time limits and background mode.

import { SearchesDomain } from 'modules/searches/domain/searches.domain';
import { LeadsDomain } from 'modules/leads/domain/leads.domain';
import { loadEnvironment } from '~config/environment';
import { createSources } from '~services/sources';
import { createOsmSource } from '~services/sources/osm';
import { createDaneSource } from '~services/sources/dane';
import { CacheTtl } from '~utils/cacheTtl';
import { getMunicipality } from '~utils/divipola';
import type { LeadSource, SourceResult } from '~types/source.types';
import { createInMemoryLeadsRepository } from '~mocks/modules/leads/leads.repository.mock';
import { createInMemorySearchesRepository } from '~mocks/modules/searches/searches.repository.mock';
import { createFakeNetwork, daneResponse } from '~mocks/services/sources.mock';

function prepare(options: { sources?: LeadSource[]; sourceMaxMs?: number; cacheMs?: number } = {}) {
  const network = createFakeNetwork();
  const env = loadEnvironment();
  env.osm.endpoints = ['https://overpass-a.test/api/interpreter', 'https://overpass-b.test/api/interpreter'];
  const searchesRepo = createInMemorySearchesRepository();
  const domain = new SearchesDomain({
    repo: searchesRepo,
    leads: new LeadsDomain(createInMemoryLeadsRepository()),
    sources: options.sources ?? createSources(env, network.fetch),
    cache: new CacheTtl<SourceResult>(options.cacheMs ?? 60000),
    sourceMaxMs: options.sourceMaxMs,
  });
  return { network, domain, searchesRepo };
}

const waitFor = async (cond: () => boolean, ms = 2000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('no se cumplió a tiempo');
    await new Promise((r) => setTimeout(r, 5));
  }
};

describe('source cache', () => {
  it('repeating the same search does not query the sources again', async () => {
    const { domain, network } = prepare();
    await domain.create({ code: '05615', category: 'hotel' });
    const calls = network.calls.length;
    const r = await domain.create({ code: '05615', category: 'hotel' });
    expect(network.calls.length).toBe(calls);
    expect(r.summary.bySource.osm?.meta).toMatchObject({ cache: true });
    expect(r.summary.leads).toBe(7);
    expect(r.summary.new).toBe(0);
  });

  it('another category or municipality does query; refresh ignores the cache', async () => {
    const { domain, network } = prepare();
    const fromDane = () => network.calls.filter((l) => l.url.includes('dane')).length;
    await domain.create({ code: '05615', category: 'hotel', sources: ['dane'] });
    const bySearch = fromDane(); // one query per CIIU of the category
    await domain.create({ code: '05615', category: 'hotel', sources: ['dane'] });
    expect(fromDane()).toBe(bySearch);
    await domain.create({ code: '05615', category: 'hotel', sources: ['dane'], refresh: true });
    await domain.create({ code: '05001', category: 'hotel', sources: ['dane'] });
    await domain.create({ code: '05615', category: 'restaurantes', sources: ['dane'] });
    expect(fromDane()).toBeGreaterThan(3 * bySearch);
  });

  it('a failing source is not cached', async () => {
    const { domain, network } = prepare();
    network.fail.osm = 'network';
    await domain.create({ code: '05615', category: 'hotel', sources: ['osm', 'dane'] });
    delete network.fail.osm;
    const r = await domain.create({ code: '05615', category: 'hotel', sources: ['osm', 'dane'] });
    expect(r.summary.bySource.osm).toMatchObject({ status: 'ok' });
    expect(r.summary.bySource.osm?.meta).not.toMatchObject({ cache: true });
  });
});

describe('time limits', () => {
  it('a source that does not respond is cut at sourceMaxMs and the rest are stored', async () => {
    const env = loadEnvironment();
    const network = createFakeNetwork();
    const hanging: LeadSource = { name: 'osm', description: 'hanging', search: () => new Promise(() => undefined) };
    const sources = createSources(env, network.fetch).map((f) => (f.name === 'osm' ? hanging : f));
    const { domain } = prepare({ sources, sourceMaxMs: 50 });
    const start = Date.now();
    const r = await domain.create({ code: '05615', category: 'hotel', sources: ['osm', 'dane'] });
    expect(Date.now() - start).toBeLessThan(1000);
    expect(r.status).toBe('partial');
    expect(r.summary.bySource.osm).toMatchObject({ status: 'error', error: expect.stringContaining('no respondió') });
  });

  it('OSM stops trying servers when its total budget runs out', async () => {
    let t = 0;
    const hosts: string[] = [];
    const osm = createOsmSource({
      endpoints: ['https://a.test', 'https://b.test', 'https://c.test'],
      timeoutMs: 30000,
      budgetMs: 45000,
      retryPauseMs: 1,
      now: () => t,
      fetchImpl: async (url) => {
        hosts.push(new URL(url).host);
        t += 30000; // each server "takes" 30 s and responds 504
        return new Response('Gateway Timeout', { status: 504 });
      },
    });
    await expect(osm.search(getMunicipality('05615')!, { applies: true, values: ['tourism=hotel'] }, { includeIndividuals: false })).rejects.toThrow(
      'Overpass no respondió'
    );
    expect(hosts).toEqual(['a.test', 'b.test']); // there is no time left for the third one
  });

  it('Overpass is never asked for more time than what is left', async () => {
    const queries: string[] = [];
    const osm = createOsmSource({
      endpoints: ['https://a.test'],
      timeoutMs: 60000,
      budgetMs: 20000,
      fetchImpl: async (_url, init) => {
        queries.push(new URLSearchParams(String(init?.body)).get('data') ?? '');
        return new Response(JSON.stringify({ elements: [{ type: 'relation', id: 1 }] }), { status: 200 });
      },
    });
    await osm.search(getMunicipality('05615')!, { applies: true, values: ['tourism=hotel'] }, { includeIndividuals: false });
    const seconds = Number(/\[timeout:(\d+)\]/.exec(queries[0])![1]);
    expect(seconds).toBeLessThanOrEqual(20);
  });
});

describe('DANE', () => {
  it('retries once if it responds 500', async () => {
    let n = 0;
    const dane = createDaneSource({
      retryPauseMs: 1,
      fetchImpl: async () => {
        n += 1;
        return n === 1 ? new Response('error', { status: 500 }) : new Response(JSON.stringify(daneResponse), { status: 200 });
      },
    });
    const r = await dane.search(getMunicipality('05615')!, { applies: true, values: [] }, { includeIndividuals: false });
    expect(n).toBe(2);
    expect(r.candidates).toHaveLength(3);
  });

  it('queries several CIIU codes at once, without exceeding the limit', async () => {
    let inProgress = 0;
    let maximum = 0;
    const dane = createDaneSource({
      parallelQueries: 2,
      fetchImpl: async () => {
        inProgress += 1;
        maximum = Math.max(maximum, inProgress);
        await new Promise((r) => setTimeout(r, 10));
        inProgress -= 1;
        return new Response(JSON.stringify(daneResponse), { status: 200 });
      },
    });
    await dane.search(getMunicipality('05615')!, { applies: true, values: ['5511', '5512', '5513', '5519'] }, { includeIndividuals: false });
    expect(maximum).toBe(2);
  });
});

describe('SearchesDomain.start (background)', () => {
  it('responds in_progress right away and finishes in the background', async () => {
    const { domain, searchesRepo } = prepare();
    const start = await domain.start({ code: '05615', category: 'hotel' });
    expect(start).toMatchObject({ searchId: 1, status: 'in_progress', municipality: { code: '05615' } });
    await waitFor(() => searchesRepo._status.searches[0].status !== 'in_progress');
    const b = await domain.get(start.searchId);
    expect(b.status).toBe('complete');
    expect(b.summary?.leads).toBe(7);
  });

  it('validates before accepting: unknown city → 404 without recording anything', async () => {
    const { domain, searchesRepo } = prepare();
    await expect(domain.start({ city: 'Gotham' })).rejects.toMatchObject({ status: 404 });
    expect(searchesRepo._status.searches).toHaveLength(0);
  });

  it('if every source fails, it is stored as failed', async () => {
    const { domain, network, searchesRepo } = prepare();
    network.fail = { dane: 'network', osm: 'network', data: 'network' };
    const { searchId } = await domain.start({ code: '05615', category: 'hotel' });
    await waitFor(() => searchesRepo._status.searches[0].status !== 'in_progress');
    expect((await domain.get(searchId)).status).toBe('failed');
  });
});
