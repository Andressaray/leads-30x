// Integration tests of the leads HTTP layer (simulated domain).
import request from 'supertest';
import { ANDRES, bearer } from '../../../setup/auth';
import { LeadsDomain } from 'modules/leads/domain/leads.domain';
import { AppError, HttpCode } from '~response/index';
import { createApp } from '~config/app';

jest.mock('modules/leads/domain/leads.domain');
jest.mock('modules/searches/domain/searches.domain');

const app = createApp();
// Every /api route requires a session: this agent sends Andres's token on every request.
const api = request.agent(app).set('Authorization', bearer());
const domain = (LeadsDomain as jest.MockedClass<typeof LeadsDomain>).mock.instances[0] as jest.Mocked<LeadsDomain>;

describe('GET /api/leads', () => {
  it('responds with the { data, status } envelope and passes the converted filters', async () => {
    domain.list.mockResolvedValue({ total: 0, page: 2, limit: 10, leads: [] });
    const r = await api.get('/api/leads?department=antioquia&contactable=true&limit=10&page=2&source=rnt');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 200, data: { total: 0, page: 2, limit: 10, leads: [] } });
    expect(domain.list).toHaveBeenCalledWith(
      expect.objectContaining({ departmentCode: '05', contactable: true, limit: 10, page: 2, source: 'rnt' })
    );
  });

  it('mine=true filters by the session user', async () => {
    domain.list.mockResolvedValue({ total: 0, page: 1, limit: 100, leads: [] });
    await api.get('/api/leads?contacted=true&mine=true');
    expect(domain.list).toHaveBeenCalledWith(expect.objectContaining({ contacted: true, contactedById: ANDRES.id }));
  });

  it('without mine it returns everyone\'s; contacted_by filters by a teammate', async () => {
    domain.list.mockResolvedValue({ total: 0, page: 1, limit: 100, leads: [] });
    await api.get('/api/leads?contacted=true');
    expect(domain.list).toHaveBeenLastCalledWith(expect.objectContaining({ contacted: true, contactedById: undefined }));
    await api.get('/api/leads?contacted=true&contacted_by=2');
    expect(domain.list).toHaveBeenLastCalledWith(expect.objectContaining({ contactedById: 2 }));
  });

  it('without a token or with an invalid token → 401', async () => {
    expect((await request(app).get('/api/leads')).status).toBe(401);
    const r = await request(app).get('/api/leads').set('Authorization', 'Bearer no-es-un-jwt');
    expect(r.status).toBe(401);
    expect(domain.list).not.toHaveBeenCalled();
  });

  it.each([
    ['limit=0', 'limit'],
    ['contacted_by=abc', 'contacted_by'],
    ['department=narnia', 'department'],
    ['source=google', 'source'],
    ['municipality=5615', 'municipality'],
  ])('rejects %s with 400', async (qs, field) => {
    const r = await api.get(`/api/leads?${qs}`);
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ status: 400, details: { field } });
    expect(domain.list).not.toHaveBeenCalled();
  });
});

describe('GET /api/leads/:id', () => {
  it('translates AppError into its status code', async () => {
    domain.get.mockRejectedValue(new AppError(HttpCode.NOT_FOUND, 'Lead no encontrado.'));
    const r = await api.get('/api/leads/9');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ status: 404, error: 'Lead no encontrado.' });
  });

  it('an unexpected error responds with a generic 500', async () => {
    domain.get.mockRejectedValue(new Error('se cayó la base'));
    const r = await api.get('/api/leads/9');
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ status: 500, error: 'Unknown error' });
  });

  it('non-numeric id → 400', async () => {
    expect((await api.get('/api/leads/abc')).status).toBe(400);
  });
});

describe('POST /api/leads/:id/mark-contacted', () => {
  it('marks the lead as contacted and responds with the { data, status } envelope', async () => {
    const lead = { id: 5, contacted: true, contactedAt: new Date('2026-10-17T00:00:00.000Z') };
    domain.markContacted.mockResolvedValue(lead as never);
    const r = await api.post('/api/leads/5/mark-contacted');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe(200);
    expect(domain.markContacted).toHaveBeenCalledWith(5, ANDRES.id);
  });

  it('if someone else already contacted it → 409 with who it was', async () => {
    const who = { id: 2, fullName: 'Camila Rojas', email: 'camila@gmail.com' };
    domain.markContacted.mockRejectedValue(
      new AppError(HttpCode.CONFLICT, 'Este lead ya lo contactó Camila Rojas.', { contactedBy: who, contactedAt: null })
    );
    const r = await api.post('/api/leads/5/mark-contacted');
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ error: 'Este lead ya lo contactó Camila Rojas.', details: { contactedBy: who } });
  });

  it('without a session → 401 and nothing is marked', async () => {
    const r = await request(app).post('/api/leads/5/mark-contacted');
    expect(r.status).toBe(401);
    expect(domain.markContacted).not.toHaveBeenCalled();
  });

  it('non-numeric id → 400', async () => {
    const r = await api.post('/api/leads/abc/mark-contacted');
    expect(r.status).toBe(400);
    expect(domain.markContacted).not.toHaveBeenCalled();
  });

  it('unknown lead → 404', async () => {
    domain.markContacted.mockRejectedValue(new AppError(HttpCode.NOT_FOUND, 'Lead no encontrado.'));
    const r = await api.post('/api/leads/999/mark-contacted');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ status: 404, error: 'Lead no encontrado.' });
  });
});

describe('GET /api/leads/export.csv', () => {
  it('downloads a CSV', async () => {
    domain.exportCsv.mockResolvedValue('﻿id,nombre\n1,Hotel\n');
    const r = await api.get('/api/leads/export.csv?search=3');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.headers['content-disposition']).toContain('leads.csv');
    expect(domain.exportCsv).toHaveBeenCalledWith(expect.objectContaining({ searchId: 3, limit: 100000 }));
  });
});

describe('general routes', () => {
  it('unknown route → 404 with the error envelope', async () => {
    const r = await api.get('/api/nada');
    expect(r.status).toBe(404);
    expect(r.body.status).toBe(404);
  });

  it('exposes the OpenAPI documentation', async () => {
    const r = await api.get('/api/docs.json');
    expect(r.status).toBe(200);
    expect(Object.keys(r.body.paths)).toEqual(
      expect.arrayContaining(['/searches', '/leads', '/leads/{id}', '/catalog/categories', '/auth/login', '/auth/me', '/users', '/users/members'])
    );
  });
});
