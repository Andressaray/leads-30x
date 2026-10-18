// Integration tests against the real test database (DATABASE_URL_TEST).
import * as repo from 'modules/leads/repository/leads.repository';
import type { CreateLeadDTO } from 'modules/leads/types/leads.types';
import { createTestSearch, createTestUser, describeWithDb, resetDb, prisma } from '../../../setup/db';

function newLead(p: Partial<CreateLeadDTO> = {}): CreateLeadDTO {
  return {
    name: 'Hotel Prueba', tradeName: 'Hotel Prueba', legalName: null, namesNorm: 'hotel prueba', nit: null,
    municipalityCode: '05615', municipality: 'RIONEGRO', department: 'Antioquia', address: 'KR 50 46 23', addressNorm: 'kr 50 46 23',
    lat: 6.1514, lon: -75.3735, ciiu: null, sourceCategory: 'tourism=hotel', categories: ['hotel'],
    phones: [{ number: '+573001112233', type: 'mobile', whatsapp: true }], emails: [], websites: [], socialLinks: [],
    primaryChannel: 'whatsapp', contactable: true, isIndividual: null, sources: ['osm'], sourceCount: 1,
    originSource: 'osm', originSearchId: null, ...p,
  };
}

describeWithDb('leads.repository', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('creates, updates and keeps phones as JSON', async () => {
    const created = await repo.createLead(newLead());
    expect(created.phones).toEqual([{ number: '+573001112233', type: 'mobile', whatsapp: true }]);
    const updated = await repo.updateLead(created.id, { nit: '900000001', sources: ['osm', 'dane'], sourceCount: 2 });
    expect(updated).toMatchObject({ nit: '900000001', sources: ['osm', 'dane'], sourceCount: 2 });
  });

  it('keys: does not duplicate and finds the lead', async () => {
    const l = await repo.createLead(newLead());
    expect(await repo.createKeys(l.id, [{ type: 'nit', value: '05615|900000001' }, { type: 'nit', value: '05615|900000001' }])).toBe(1);
    expect((await repo.findLeadByKey('nit', '05615|900000001'))?.id).toBe(l.id);
    expect(await repo.findLeadByKey('nit', '05615|999')).toBeNull();
  });

  it('occurrences: upsert by (source, external id)', async () => {
    const b = await createTestSearch();
    const l = await repo.createLead(newLead());
    await repo.upsertOccurrence({ leadId: l.id, source: 'osm', externalId: 'node/1', match: 'new', data: { v: 1 }, searchId: b });
    await repo.upsertOccurrence({ leadId: l.id, source: 'osm', externalId: 'node/1', match: 'new', data: { v: 2 }, searchId: b });
    expect((await repo.findLeadByOccurrence('osm', 'node/1'))?.id).toBe(l.id);
    const detail = await repo.findLeadDetail(l.id);
    expect(detail?.occurrences).toHaveLength(1);
    expect(detail?.occurrences[0].data).toEqual({ v: 2 });
  });

  it('spatial, street number and word searches', async () => {
    const a = await repo.createLead(newLead());
    await repo.createLead(newLead({ name: 'Lejos', namesNorm: 'lejos', lat: 6.3, lon: -75.6, addressNorm: null }));
    await repo.createLead(newLead({ municipalityCode: '05001', namesNorm: 'hotel prueba' }));
    expect((await repo.findNearbyLeads('05615', 6.1515, -75.3736, 0.003)).map((l) => l.id)).toEqual([a.id]);
    expect((await repo.findLeadsByAddress('05615', 'kr 50 46 23')).map((l) => l.id)).toEqual([a.id]);
    expect((await repo.findLeadsByWord('05615', 'prueba')).map((l) => l.id)).toEqual([a.id]);
  });

  it('listing with filters, counts and stats', async () => {
    const b = await createTestSearch();
    const a = await repo.createLead(newLead({ sources: ['dane', 'osm'], sourceCount: 2, nit: '900000001' }));
    const c = await repo.createLead(newLead({ name: 'Sin contacto', namesNorm: 'sin contacto', contactable: false, primaryChannel: null, phones: [], isIndividual: true }));
    await repo.createSearchLead(b, a.id, 'dane', 'new');
    await repo.createSearchLead(b, a.id, 'osm', 'enriched');
    await repo.createSearchLead(b, c.id, 'osm', 'new');
    await repo.upsertOccurrence({ leadId: a.id, source: 'dane', externalId: '900000001', match: 'new', data: null, searchId: b });

    expect(await repo.countLeads({ searchId: b })).toBe(2);
    expect(await repo.countLeads({ searchId: b, contactable: true })).toBe(1);
    expect(await repo.countLeads({ inBoth: true })).toBe(1);
    expect(await repo.countLeads({ source: 'dane' })).toBe(1);
    expect(await repo.countLeads({ individuals: false })).toBe(1);
    expect(await repo.countLeads({ q: '900000001' })).toBe(1);
    expect(await repo.countLeads({ departmentCode: '05' })).toBe(2);
    expect(await repo.countNewLeadsOfSearch(b)).toBe(2);
    const page = await repo.findLeads({ limit: 1, page: 1 });
    expect(page.map((l) => l.id)).toEqual([a.id]);
    expect(await repo.findStatsBySource()).toEqual([{ source: 'dane', leads: 1, contactables: 1, attributed: 0 }]);
  });

  it('assignContact: only the first one keeps the lead and the listing returns who contacted it', async () => {
    const andres = await createTestUser();
    const camila = await createTestUser({ email: 'camila@gmail.com', fullName: 'Camila Rojas' });
    const a = await repo.createLead(newLead());
    const b = await repo.createLead(newLead({ name: 'Otro', namesNorm: 'other' }));

    // Two people press "Contact" at the same time: only one wins.
    const [r1, r2] = await Promise.all([repo.assignContact(a.id, andres), repo.assignContact(a.id, camila)]);
    expect([r1, r2].filter(Boolean)).toHaveLength(1);
    expect(await repo.assignContact(b.id, camila)).toBe(true);

    const detail = await repo.findLead(a.id);
    expect(detail).toMatchObject({ contacted: true, contactedBy: { id: detail!.contactedById, email: expect.any(String) } });
    expect(detail!.contactedAt).toBeTruthy();

    expect(await repo.countLeads({ contacted: true })).toBe(2);
    expect(await repo.countLeads({ contacted: true, contactedById: camila })).toBe(r2 ? 2 : 1);
    const list = await repo.findLeads({ contacted: true, limit: 10, page: 1 });
    expect(list.every((l) => l.contactedBy && !('passwordHash' in l.contactedBy))).toBe(true);

    // Enriching the lead from a search does not touch the contact.
    await repo.updateLead(b.id, { emails: ['hola@otro.co'], contacted: false, contactedById: null });
    expect(await repo.findLead(b.id)).toMatchObject({ emails: ['hola@otro.co'], contacted: true, contactedById: camila });
  });
});
