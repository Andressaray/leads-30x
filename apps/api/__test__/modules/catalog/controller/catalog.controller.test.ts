import request from 'supertest';
import { bearer } from '../../../setup/auth';
import { createApp } from '~config/app';

jest.mock('modules/searches/domain/searches.domain');

const app = createApp();
// Every /api route requires a session: this agent sends Andres's token on every request.
const api = request.agent(app).set('Authorization', bearer());

describe('Catalog', () => {
  it('GET /api/catalog/categories', async () => {
    const r = await api.get('/api/catalog/categories');
    expect(r.status).toBe(200);
    expect(r.body.data.map((c: { key: string }) => c.key)).toContain('hotel');
  });

  it('GET /api/catalog/departments', async () => {
    const r = await api.get('/api/catalog/departments');
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBe(33);
    expect(r.body.data).toEqual(expect.arrayContaining([{ code: '05', name: 'Antioquia' }]));
  });

  it('GET /api/catalog/municipalities filters by department', async () => {
    const r = await api.get('/api/catalog/municipalities?q=granada&department=meta');
    expect(r.body.data).toEqual([expect.objectContaining({ code: '50313', department: 'Meta' })]);
  });

  it('unknown department → 400', async () => {
    expect((await api.get('/api/catalog/municipalities?department=narnia')).status).toBe(400);
  });
});
