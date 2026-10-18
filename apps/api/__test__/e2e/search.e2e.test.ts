// End to end: HTTP → domain → sources (simulated network) → real PostgreSQL.
import request from 'supertest';
import { createApp } from '~config/app';
import { createFakeNetwork } from '~mocks/services/sources.mock';
import { createTestUser, describeWithDb, resetDb, prisma } from '../setup/db';

const network = createFakeNetwork();
jest.spyOn(global, 'fetch').mockImplementation((input: string | URL | Request, init?: RequestInit) => network.fetch(String(input), init));

describeWithDb('POST /api/searches end to end', () => {
  const app = createApp();
  let api: ReturnType<typeof request.agent>;
  let token2: string;

  beforeAll(async () => {
    await resetDb();
    await createTestUser();
    await createTestUser({ email: 'camila@gmail.com', fullName: 'Camila Rojas' });
    // Real login: email + password → token
    const login = await request(app).post('/api/auth/login').send({ email: 'andres@gmail.com', password: 'Andres1234*' });
    expect(login.status).toBe(200);
    api = request.agent(app).set('Authorization', `Bearer ${login.body.data.token}`);
    token2 = (await request(app).post('/api/auth/login').send({ email: 'camila@gmail.com', password: 'Andres1234*' })).body.data.token;
  });
  afterAll(() => prisma.$disconnect());

  it('without login it does not allow searching', async () => {
    const r = await request(app).post('/api/searches').send({ code: '05615' });
    expect(r.status).toBe(401);
    const bad = await request(app).post('/api/auth/login').send({ email: 'andres@gmail.com', password: 'mala' });
    expect(bad.status).toBe(401);
  });

  it('stores the matched leads in PostgreSQL and repeating does not duplicate', async () => {
    const r1 = await api.post('/api/searches').send({ city: 'Rionegro', department: 'Antioquia', category: 'hoteles' });
    expect(r1.status).toBe(201);
    expect(r1.body.data.summary).toMatchObject({ leads: 7, new: 7, contactables: 5, inMultipleSources: 4 });

    const r2 = await api.post('/api/searches').send({ code: '05615', category: 'hotel' });
    expect(r2.body.data.summary).toMatchObject({ leads: 7, new: 0 });
    expect(await prisma.lead.count()).toBe(7);

    const both = await api.get('/api/leads?in_both=true');
    expect(both.body.data.total).toBe(4);

    const id = both.body.data.leads.find((l: { nit: string }) => l.nit === '901333444').id;
    const detail = await api.get(`/api/leads/${id}`);
    expect(detail.body.data.occurrences.map((a: { source: string; match: string }) => `${a.source}:${a.match}`)).toEqual(
      expect.arrayContaining(['dane:new', 'secop:nit', 'osm:address'])
    );

    const csv = await api.get(`/api/leads/export.csv?search=${r1.body.data.searchId}&contactable=true`);
    expect(csv.text.trim().split('\n')).toHaveLength(6);

    const stats = await api.get('/api/leads/stats');
    expect(stats.body.data.map((s: { source: string }) => s.source)).toEqual(['dane', 'osm', 'rnt', 'secop']);
  });

  it('Contact assigns the lead to whoever contacted it and Contacted filters by person', async () => {
    const list = (await api.get('/api/leads?limit=3')).body.data.leads as { id: number }[];
    const [one, two] = list.map((l) => l.id);

    const r = await api.post(`/api/leads/${one}/mark-contacted`);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ contacted: true, contactedBy: { fullName: 'Andres Saray' } });

    const camila = (path: string) => request(app).post(path).set('Authorization', `Bearer ${token2}`);
    const conflict = await camila(`/api/leads/${one}/mark-contacted`);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error).toBe('Este lead ya lo contactó Andres Saray.');
    expect((await camila(`/api/leads/${two}/mark-contacted`)).status).toBe(200);

    const all = (await api.get('/api/leads?contacted=true')).body.data;
    expect(all.total).toBe(2);
    expect(all.leads.map((l: { contactedBy: { fullName: string } }) => l.contactedBy.fullName).sort()).toEqual(['Andres Saray', 'Camila Rojas']);
    const mine = (await api.get('/api/leads?contacted=true&mine=true')).body.data;
    expect(mine.leads.map((l: { id: number }) => l.id)).toEqual([one]);

    const csv = await api.get('/api/leads/export.csv?contacted=true');
    expect(csv.text).toContain('Andres Saray');
  });
});
