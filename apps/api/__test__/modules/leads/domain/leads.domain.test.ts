// Unit tests of the matching and lead query rules (in-memory repository).

import { LeadsDomain } from 'modules/leads/domain/leads.domain';
import { acceptsByNameAndDistance, primaryChannel } from 'modules/leads/domain/leads.matching';
import { getMunicipality } from '~utils/divipola';
import type { Candidate } from '~types/source.types';
import { createInMemoryLeadsRepository } from '~mocks/modules/leads/leads.repository.mock';

const rionegro = getMunicipality('05615')!;
const ctx = { municipality: rionegro, category: 'hotel', searchId: 1 };

function cand(p: Partial<Candidate> & Pick<Candidate, 'source' | 'externalId'>): Candidate {
  return {
    name: null, legalName: null, tradeName: null, nit: null, municipalityCode: '05615', address: null,
    lat: null, lon: null, ciiu: null, sourceCategory: null, phones: [], emails: [], websites: [], socialLinks: [],
    isIndividual: null, raw: {}, ...p,
  };
}

function prepare() {
  const repo = createInMemoryLeadsRepository();
  return { repo, domain: new LeadsDomain(repo) };
}

describe('LeadsDomain.registerCandidates', () => {
  it('a generic name ("Hotel") does not match anything', async () => {
    const { domain, repo } = prepare();
    await domain.registerCandidates([cand({ source: 'dane', externalId: '1', name: 'HOTEL SAS', nit: '900000001', lat: 6.15, lon: -75.37 })], ctx);
    const r = await domain.registerCandidates([cand({ source: 'osm', externalId: 'node/1', name: 'Hotel', lat: 6.15, lon: -75.37 })], ctx);
    expect(r.new).toBe(1);
    expect(repo._status.leads).toHaveLength(2);
  });

  it('two different DANE records are never merged by name', async () => {
    const { domain, repo } = prepare();
    await domain.registerCandidates(
      [
        cand({ source: 'dane', externalId: '900000001', nit: '900000001', legalName: 'GRUPO ANDINO DEL ORIENTE SAS', name: 'GRUPO ANDINO DEL ORIENTE SAS', lat: 6.15, lon: -75.37 }),
        cand({ source: 'dane', externalId: '900000002', nit: '900000002', legalName: 'GRUPO ANDINO DEL ORIENTE ZOMAC SAS', name: 'GRUPO ANDINO DEL ORIENTE ZOMAC SAS', lat: 6.15, lon: -75.37 }),
      ],
      ctx
    );
    expect(repo._status.leads).toHaveLength(2);
  });

  it('a shared phone does not merge businesses with different names and locations', async () => {
    const { domain, repo } = prepare();
    const tel = [{ number: '+576045550000', type: 'landline' as const }];
    await domain.registerCandidates([cand({ source: 'osm', externalId: 'node/1', name: 'Ferretería El Tornillo', phones: tel, lat: 6.15, lon: -75.37 })], ctx);
    await domain.registerCandidates([cand({ source: 'rnt', externalId: 'r1', name: 'HOTEL LOS PINOS', phones: tel })], ctx);
    expect(repo._status.leads).toHaveLength(2);
  });

  it('the same street number repeated in the batch (shopping mall) is not used to match', async () => {
    const { domain, repo } = prepare();
    await domain.registerCandidates([cand({ source: 'dane', externalId: '900000003', nit: '900000003', name: 'COMERCIAL XYZ SAS', address: 'KR 43A 1 50' })], ctx);
    const r = await domain.registerCandidates(
      [
        cand({ source: 'osm', externalId: 'node/7', name: 'Tienda Uno', address: 'Carrera 43A # 1-50' }),
        cand({ source: 'osm', externalId: 'node/8', name: 'Tienda Dos', address: 'Carrera 43A # 1-50' }),
      ],
      ctx
    );
    expect(r.new).toBe(2);
    expect(repo._status.leads).toHaveLength(3);
  });

  it('the same company in two municipalities is two leads', async () => {
    const { domain, repo } = prepare();
    const medellin = getMunicipality('05001')!;
    await domain.registerCandidates([cand({ source: 'dane', externalId: 'a', nit: '900000004', name: 'EMPRESA UNO SAS' })], ctx);
    await domain.registerCandidates(
      [cand({ source: 'rnt', externalId: 'b', nit: '900000004', name: 'EMPRESA UNO', municipalityCode: '05001' })],
      { ...ctx, municipality: medellin }
    );
    expect(repo._status.leads.map((l) => l.municipalityCode).sort()).toEqual(['05001', '05615']);
  });

  it('without coordinates, it matches by name only if there is a single candidate with 2+ words in common', async () => {
    const { domain, repo } = prepare();
    await domain.registerCandidates([cand({ source: 'osm', externalId: 'node/9', name: 'Hostal Cielo Azul', lat: 6.15, lon: -75.37 })], ctx);
    const r = await domain.registerCandidates(
      [cand({ source: 'rnt', externalId: 'r9', name: 'HOSTAL CIELO AZUL', emails: ['cielo@azul.example.co'] })],
      ctx
    );
    expect(r.enriched).toBe(1);
    expect(repo._status.leads).toHaveLength(1);
    expect(repo._status.occurrences.find((a) => a.externalId === 'r9')?.match).toBe('name');
  });

  it('records without a name count as skipped', async () => {
    const { domain } = prepare();
    const r = await domain.registerCandidates([cand({ source: 'osm', externalId: 'node/10' })], ctx);
    expect(r).toMatchObject({ records: 1, skipped: 1, new: 0 });
  });
});

describe('LeadsDomain queries', () => {
  it('get throws 404 if it does not exist', async () => {
    const { domain } = prepare();
    await expect(domain.get(42)).rejects.toMatchObject({ status: 404 });
  });

  it('exportCsv adds the BOM and headers and escapes commas', async () => {
    const { domain } = prepare();
    await domain.registerCandidates(
      [cand({ source: 'osm', externalId: 'node/1', name: 'Café, Pan y Más', phones: [{ number: '+573001112233', type: 'mobile', whatsapp: true }], lat: 6.1, lon: -75.3 })],
      ctx
    );
    const csv = await domain.exportCsv({ limit: 100, page: 1 });
    const [header, row] = csv.slice(1).trim().split('\n');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(header.startsWith('id,nombre,razon_social,nit')).toBe(true);
    expect(row).toContain('"Café, Pan y Más"');
    expect(row).toContain('+573001112233');
  });

  it('list respects filters and pagination', async () => {
    const { domain } = prepare();
    await domain.registerCandidates(
      [
        cand({ source: 'osm', externalId: 'n1', name: 'Uno Alfa', lat: 6.1, lon: -75.3, emails: ['a@b.co'] }),
        cand({ source: 'osm', externalId: 'n2', name: 'Dos Beta', lat: 6.2, lon: -75.4 }),
      ],
      ctx
    );
    const r = await domain.list({ contactable: true, limit: 10, page: 1 });
    expect(r.total).toBe(1);
    expect(r.leads[0].name).toBe('Uno Alfa');
  });
});

describe('LeadsDomain.markContacted', () => {
  async function withOneLead() {
    const p = prepare();
    await p.domain.registerCandidates([cand({ source: 'osm', externalId: 'n1', name: 'Hotel Uno', lat: 6.1, lon: -75.3 })], ctx);
    return p;
  }

  it('assigns the lead to whoever presses Contact', async () => {
    const { domain } = await withOneLead();
    const lead = await domain.markContacted(1, 1);
    expect(lead).toMatchObject({ contacted: true, contactedById: 1, contactedBy: { fullName: 'Andres Saray' } });
    expect(lead.contactedAt).toBeTruthy();
  });

  it('pressing Contact again by the same user changes nothing', async () => {
    const { domain } = await withOneLead();
    const first = await domain.markContacted(1, 1);
    const second = await domain.markContacted(1, 1);
    expect(second.contactedAt).toEqual(first.contactedAt);
  });

  it('if someone else already contacted it, responds 409 and does not reassign it', async () => {
    const { domain, repo } = await withOneLead();
    await domain.markContacted(1, 2);
    await expect(domain.markContacted(1, 1)).rejects.toMatchObject({
      status: 409,
      message: 'Este lead ya lo contactó Camila Rojas.',
    });
    expect(repo._status.leads[0].contactedById).toBe(2);
  });

  it('404 if the lead does not exist', async () => {
    const { domain } = prepare();
    await expect(domain.markContacted(42, 1)).rejects.toMatchObject({ status: 404 });
  });

  it('a search that enriches the lead does not erase who contacted it', async () => {
    const { domain, repo } = await withOneLead();
    await domain.markContacted(1, 1);
    await domain.registerCandidates(
      [cand({ source: 'osm', externalId: 'n1', name: 'Hotel Uno', lat: 6.1, lon: -75.3, emails: ['hola@hoteluno.co'] })],
      ctx
    );
    expect(repo._status.leads[0]).toMatchObject({ emails: ['hola@hoteluno.co'], contacted: true, contactedById: 1 });
  });

  it('list with contactedById returns only that person\'s leads', async () => {
    const { domain } = prepare();
    await domain.registerCandidates(
      [
        cand({ source: 'osm', externalId: 'n1', name: 'Uno Alfa', lat: 6.1, lon: -75.3 }),
        cand({ source: 'osm', externalId: 'n2', name: 'Dos Beta', lat: 6.2, lon: -75.4 }),
      ],
      ctx
    );
    await domain.markContacted(1, 1);
    await domain.markContacted(2, 2);
    expect((await domain.list({ contacted: true, limit: 10, page: 1 })).total).toBe(2);
    const mine = await domain.list({ contacted: true, contactedById: 1, limit: 10, page: 1 });
    expect(mine.leads.map((l) => l.name)).toEqual(['Uno Alfa']);
  });
});

describe('pure rules', () => {
  it('name and distance thresholds', () => {
    expect(acceptsByNameAndDistance({ score: 1, common: 2, minimum: 2 }, 250)).toBe(true);
    expect(acceptsByNameAndDistance({ score: 1, common: 1, minimum: 1 }, 100)).toBe(true);
    expect(acceptsByNameAndDistance({ score: 1, common: 1, minimum: 1 }, 200)).toBe(false);
    expect(acceptsByNameAndDistance({ score: 0.5, common: 1, minimum: 2 }, 10)).toBe(false);
  });

  it('primary channel: WhatsApp > mobile > landline > email > web > social', () => {
    expect(primaryChannel({ phones: [{ number: '+576041', type: 'landline' }, { number: '+573001', type: 'mobile' }], emails: [], websites: [], socialLinks: [] })).toBe('mobile');
    expect(primaryChannel({ phones: [], emails: [], websites: [], socialLinks: ['https://instagram.com/x'] })).toBe('social');
    expect(primaryChannel({ phones: [], emails: [], websites: [], socialLinks: [] })).toBeNull();
  });
});
