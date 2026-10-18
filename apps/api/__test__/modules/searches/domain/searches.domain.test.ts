// Unit tests of the searches domain: orchestration of the 5 sources and
// matching between them. In-memory repositories and a simulated network: no database or internet.

import { SearchesDomain } from 'modules/searches/domain/searches.domain';
import { LeadsDomain } from 'modules/leads/domain/leads.domain';
import { AppError } from '~response/index';
import { loadEnvironment } from '~config/environment';
import { createSources } from '~services/sources';
import { createInMemoryLeadsRepository } from '~mocks/modules/leads/leads.repository.mock';
import { createInMemorySearchesRepository } from '~mocks/modules/searches/searches.repository.mock';
import { createFakeNetwork, type FakeNetwork } from '~mocks/services/sources.mock';

function prepare() {
  const network: FakeNetwork = createFakeNetwork();
  const env = loadEnvironment();
  env.osm.endpoints = ['https://overpass-a.test/api/interpreter', 'https://overpass-b.test/api/interpreter'];
  const leadsRepo = createInMemoryLeadsRepository();
  const searchesRepo = createInMemorySearchesRepository();
  const sources = createSources(env, network.fetch);
  const domain = new SearchesDomain({ repo: searchesRepo, leads: new LeadsDomain(leadsRepo), sources });
  return { network, leadsRepo, searchesRepo, domain };
}

describe('SearchesDomain.create', () => {
  it('queries the 5 sources, matches the results and does not duplicate', async () => {
    const { domain, leadsRepo } = prepare();
    const r = await domain.create({ city: 'Rionegro', department: 'Antioquia', category: 'hoteles' });

    expect(r.status).toBe('complete');
    expect(r.municipality.code).toBe('05615');
    const pf = r.summary.bySource;
    expect(pf.dane).toMatchObject({ status: 'ok', records: 3, new: 3 });
    expect(pf.rnt).toMatchObject({ status: 'ok', records: 3, new: 1, enriched: 2, meta: { skipped_individuals: 1 } });
    expect(pf.secop).toMatchObject({ status: 'ok', records: 2, new: 1, enriched: 1 });
    expect(pf.reps).toMatchObject({ status: 'skipped' });
    expect(pf.osm).toMatchObject({ status: 'ok', records: 6, new: 2, enriched: 3, unchanged: 1 });

    expect(r.summary).toMatchObject({ leads: 7, new: 7, contactables: 5, inMultipleSources: 4 });
    expect(leadsRepo._status.leads).toHaveLength(7);

    // DANE (NIT) + RNT (contact) + OSM (trade name and coordinates of the place)
    const mirador = r.leads.find((l) => l.nit === '900111222')!;
    expect(mirador.name).toBe('HOTEL MIRADOR DEL ORIENTE');
    expect(mirador.legalName).toBe('HOTEL EL MIRADOR DEL ORIENTE SAS');
    expect(mirador.sources).toEqual(['dane', 'rnt', 'osm']);
    expect(mirador.originSource).toBe('dane');
    expect(mirador.emails).toEqual(['reservas@mirador.example.co', 'gerencia@mirador.example.co']);
    expect(mirador.phones.map((t) => t.number)).toEqual(['+573005550201', '+576045550202', '+576045550101']);
    expect(mirador.lat).toBe(6.15153);

    // Legal name ≠ trade name, merged by street number (DANE + SECOP + OSM)
    const alborada = r.leads.find((l) => l.nit === '901333444')!;
    expect(alborada.name).toBe('Hostal Las Golondrinas');
    expect(alborada.sources).toEqual(['dane', 'secop', 'osm']);
    expect(alborada.websites).toEqual(['www.casaalborada.example.co']);
    expect(alborada.primaryChannel).toBe('whatsapp');

    // RNT without coordinates + OSM, merged by street number
    const tourist = r.leads.find((l) => l.nit === '901777888')!;
    expect(tourist.sources).toEqual(['rnt', 'osm']);
    expect(tourist.lat).toBe(6.15451);

    // The RNT individual is left out
    expect(leadsRepo._status.leads.some((l) => l.name === 'APARTAMENTO LAS FLORES')).toBe(false);
  });

  it('repeating the search does not create new leads', async () => {
    const { domain, leadsRepo } = prepare();
    await domain.create({ city: 'Rionegro', department: 'Antioquia', category: 'hotel' });
    const r = await domain.create({ code: '05615', category: 'hotel' });
    expect(r.summary.leads).toBe(7);
    expect(r.summary.new).toBe(0);
    expect(r.summary.bySource.osm).toMatchObject({ new: 0, unchanged: 6 });
    expect(leadsRepo._status.leads).toHaveLength(7);
  });

  it('with individuals included, it also stores the RNT ones', async () => {
    const { domain } = prepare();
    const r = await domain.create({ code: '05615', category: 'hotel', sources: ['rnt'], includeIndividuals: true });
    expect(r.summary.bySource.rnt).toMatchObject({ records: 4, new: 4 });
    expect(r.leads.find((l) => l.name === 'APARTAMENTO LAS FLORES')?.isIndividual).toBe(true);
  });

  it('only sends datos.gov.co filters built from validated values', async () => {
    const { domain, network } = prepare();
    await domain.create({ code: '05615', category: 'hotel', sources: ['rnt', 'secop'] });
    const where = (u: string) => new URL(u).searchParams.get('$where');
    const rnt = where(network.calls.find((l) => l.url.includes('thwd-ivmp'))!.url);
    expect(rnt).toContain("cod_mun='05615' AND estado_rnt='ACTIVO' AND categoria in ('ESTABLECIMIENTOS DE ALOJAMIENTO TURÍSTICO')");
    const secop = where(network.calls.find((l) => l.url.includes('qmzu-gj57'))!.url);
    expect(secop).toContain("ubicacion like '%-05615' AND esta_activa='Si' AND tipo_empresa not like 'PERSONA NATURAL%'");
    expect(secop).toContain("codigo_categoria_principal like 'V1.9011%'");
  });

  it('for health it queries REPS and drops the phone extension', async () => {
    const { domain, network } = prepare();
    const r = await domain.create({ code: '05615', category: 'health', sources: ['reps'] });
    const ips = r.leads[0];
    expect(ips.nit).toBe('900222333');
    expect(ips.phones.map((t) => t.number)).toEqual(['+576045550601', '+573005550801']);
    expect(new URL(network.calls[0].url).searchParams.get('$where')).toBe("municipiosede='05615' AND tipoid='NI'");
  });

  it('if a source fails, the rest are stored and the search is partial', async () => {
    const { domain, network } = prepare();
    network.fail.osm = 'network';
    const r = await domain.create({ code: '05615', category: 'hotel' });
    expect(r.status).toBe('partial');
    expect(r.summary.bySource.osm).toMatchObject({ status: 'error' });
    expect(r.summary.bySource.dane).toMatchObject({ status: 'ok', new: 3 });
  });

  it('if every source fails it responds 502 with the detail', async () => {
    const { domain, network } = prepare();
    network.fail = { dane: 'network', osm: 'network', data: 'network' };
    await expect(domain.create({ code: '05615', category: 'hotel' })).rejects.toMatchObject({ status: 502 });
  });

  it('if Overpass responds 429 it retries with the next server', async () => {
    const { domain, network } = prepare();
    network.fail.osm = 429;
    const r = await domain.create({ code: '05615', category: 'hotel', sources: ['osm'] });
    expect(r.status).toBe('complete');
    const hosts = network.calls.map((l) => new URL(l.url).host);
    expect(hosts).toEqual(['overpass-a.test', 'overpass-b.test']);
  });

  it('if the municipality has no boundary in OSM it searches within a radius', async () => {
    const { domain, network } = prepare();
    network.osmUnlimited = true;
    const r = await domain.create({ city: 'Abriaquí', category: 'hotel', sources: ['osm'] });
    expect(r.summary.bySource.osm?.meta).toMatchObject({ scope: 'radius_4000m' });
    expect(network.calls.at(-1)!.body).toContain('around%3A4000%2C6.632282%2C-76.064304');
  });

  it('repeated city → 409 with the options', async () => {
    const { domain } = prepare();
    const error = await domain.create({ city: 'Granada' }).catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(409);
    expect(error.details.candidates.map((c: { code: string }) => c.code)).toEqual(['05313', '25312', '50313']);
  });

  it('input errors: unknown city, unknown category', async () => {
    const { domain } = prepare();
    await expect(domain.create({ city: 'Gotham' })).rejects.toMatchObject({ status: 404 });
    await expect(domain.create({ city: 'Medellín', category: 'naves espaciales' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('SearchesDomain.get / list', () => {
  it('returns the detail per source and 404 if it does not exist', async () => {
    const { domain } = prepare();
    const { searchId } = await domain.create({ code: '05615', category: 'hotel', sources: ['dane'] });
    const b = await domain.get(searchId);
    expect(b.status).toBe('complete');
    expect(b.sources?.[0]).toMatchObject({ source: 'dane', new: 3 });
    expect(await domain.list(10)).toHaveLength(1);
    await expect(domain.get(999)).rejects.toMatchObject({ status: 404 });
  });
});
