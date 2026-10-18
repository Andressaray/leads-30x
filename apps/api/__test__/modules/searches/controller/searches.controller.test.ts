// Integration tests of the searches HTTP layer (simulated domain).
import request from 'supertest';
import { bearer } from '../../../setup/auth';
import { SearchesDomain } from 'modules/searches/domain/searches.domain';
import { AppError, HttpCode } from '~response/index';
import { createApp } from '~config/app';

jest.mock('modules/searches/domain/searches.domain');
jest.mock('modules/leads/domain/leads.domain');

const app = createApp();
// Every /api route requires a session: this agent sends Andres's token on every request.
const api = request.agent(app).set('Authorization', bearer());
const domain = (SearchesDomain as jest.MockedClass<typeof SearchesDomain>).mock.instances[0] as jest.Mocked<SearchesDomain>;

describe('POST /api/searches', () => {
  it('201 and normalizes lists sent as text', async () => {
    domain.create.mockResolvedValue({ searchId: 1 } as never);
    const r = await api
      .post('/api/searches')
      .send({ city: 'Rionegro', department: 'Antioquia', ciiu: '4752,4663', sources: ['dane', 'osm'], includeIndividuals: false });
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ status: 201, data: { searchId: 1 } });
    expect(domain.create).toHaveBeenCalledWith({
      city: 'Rionegro', department: 'Antioquia', ciiu: ['4752', '4663'], sources: ['dane', 'osm'], includeIndividuals: false,
    });
  });

  it('with async: true responds 202 and does not wait for the result', async () => {
    domain.start.mockResolvedValue({ searchId: 3, status: 'in_progress' } as never);
    const r = await api.post('/api/searches').send({ code: '05615', async: true, refresh: 'true' });
    expect(r.status).toBe(202);
    expect(r.body).toEqual({ status: 202, data: { searchId: 3, status: 'in_progress' } });
    expect(domain.start).toHaveBeenCalledWith({ code: '05615', refresh: true });
    expect(domain.create).not.toHaveBeenCalled();
  });

  it.each([
    [{}, 'Envía "city"'],
    [{ city: 'Rionegro', sources: ['google'] }, 'sources'],
    [{ city: 'Rionegro', ciiu: ['47'] }, 'ciiu'],
    [{ code: '123' }, 'code'],
    [{ city: 'Rionegro', osm: ['shop"];out;'] }, 'osm'],
  ])('rejects %j with 400', async (body, text) => {
    const r = await api.post('/api/searches').send(body);
    expect(r.status).toBe(400);
    expect(r.body.error).toContain(text);
    expect(domain.create).not.toHaveBeenCalled();
  });

  it('malformed JSON → 400', async () => {
    const r = await api.post('/api/searches').set('Content-Type', 'application/json').send('{"city":');
    expect(r.status).toBe(400);
  });

  it('ambiguous city: 409 with the options in details', async () => {
    domain.create.mockRejectedValue(
      new AppError(HttpCode.CONFLICT, 'Hay 3 municipios llamados "Granada".', { candidates: [{ code: '50313' }] })
    );
    const r = await api.post('/api/searches').send({ city: 'Granada' });
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ status: 409, error: 'Hay 3 municipios llamados "Granada".', details: { candidates: [{ code: '50313' }] } });
  });
});

describe('GET /api/searches', () => {
  it('list and detail', async () => {
    domain.list.mockResolvedValue([]);
    domain.get.mockRejectedValue(new AppError(HttpCode.NOT_FOUND, 'Búsqueda no encontrada.'));
    expect((await api.get('/api/searches?limit=5')).body).toEqual({ status: 200, data: [] });
    expect(domain.list).toHaveBeenCalledWith(5);
    expect((await api.get('/api/searches/77')).status).toBe(404);
  });
});
