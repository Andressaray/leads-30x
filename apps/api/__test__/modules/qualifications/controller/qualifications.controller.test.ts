import request from 'supertest';
import { QualificationsDomain } from 'modules/qualifications/domain/qualifications.domain';
import { AppError, HttpCode } from '~response/index';
import { createApp } from '~config/app';
import { ANDRES, bearer } from '../../../setup/auth';

jest.mock('modules/qualifications/domain/qualifications.domain', () => {
  const unique = { status: jest.fn(), list: jest.fn(), send: jest.fn(), sendBatch: jest.fn(), receiveResult: jest.fn(), qualifyManually: jest.fn() };
  return { QualificationsDomain: jest.fn(() => unique), MAX_BATCH: 100 };
});
jest.mock('modules/searches/domain/searches.domain');

const app = createApp();
const api = request.agent(app).set('Authorization', bearer());
const domain = new QualificationsDomain() as jest.Mocked<QualificationsDomain>;

describe('routes with a session', () => {
  it('require a session', async () => {
    expect((await request(app).post('/api/leads/5/dapta')).status).toBe(401);
    expect((await request(app).get('/api/dapta/status')).status).toBe(401);
    expect((await request(app).post('/api/dapta/dispatches').send({ leadIds: [1] })).status).toBe(401);
  });

  it('POST /leads/:id/dapta → 201 and translates errors', async () => {
    domain.send.mockResolvedValue({ id: 1 } as never);
    expect((await api.post('/api/leads/5/dapta')).status).toBe(201);
    expect(domain.send).toHaveBeenCalledWith(5, ANDRES);
    domain.send.mockRejectedValue(new AppError(HttpCode.SERVICE_UNAVAILABLE, 'Sin Dapta'));
    expect((await api.post('/api/leads/5/dapta')).body).toEqual({ status: 503, error: 'Sin Dapta' });
  });

  it('GET /leads/:id/qualifications and POST /leads/:id/qualification', async () => {
    domain.list.mockResolvedValue([]);
    expect((await api.get('/api/leads/5/qualifications')).status).toBe(200);
    domain.qualifyManually.mockResolvedValue({ id: 2 } as never);
    expect((await api.post('/api/leads/5/qualification').send({ quality: 'medium', score: 50 })).status).toBe(201);
    expect(domain.qualifyManually).toHaveBeenCalledWith(5, { quality: 'MEDIUM', score: 50, note: undefined }, ANDRES);
    expect((await api.post('/api/leads/5/qualification').send({ quality: 'genial' })).status).toBe(400);
    expect((await api.post('/api/leads/5/qualification').send({ quality: 'HIGH', score: 101 })).status).toBe(400);
  });

  it('POST /dapta/dispatches validates the list', async () => {
    domain.sendBatch.mockResolvedValue({ sent: 1, skipped: 0, results: [] });
    expect((await api.post('/api/dapta/dispatches').send({ leadIds: [1, '2'] })).status).toBe(200);
    expect(domain.sendBatch).toHaveBeenCalledWith([1, 2], ANDRES);
    expect((await api.post('/api/dapta/dispatches').send({ leadIds: [] })).status).toBe(400);
    expect((await api.post('/api/dapta/dispatches').send({ leadIds: ['x'] })).status).toBe(400);
  });
});

describe('POST /api/dapta/webhook (no session)', () => {
  beforeEach(() => domain.receiveResult.mockResolvedValue({ id: 1, leadId: 5, status: 'QUALIFIED', quality: 'HIGH', score: 90 } as never));

  it('takes the secret from the header, the Bearer or ?token', async () => {
    await request(app).post('/api/dapta/webhook').set('x-dapta-secret', 's1').send({ reference: 'r' });
    expect(domain.receiveResult).toHaveBeenLastCalledWith({ reference: 'r' }, 's1');
    await request(app).post('/api/dapta/webhook').set('Authorization', 'Bearer s2').send({ reference: 'r' });
    expect(domain.receiveResult).toHaveBeenLastCalledWith({ reference: 'r' }, 's2');
    const r = await request(app).post('/api/dapta/webhook?token=s3').send({ reference: 'r' });
    expect(domain.receiveResult).toHaveBeenLastCalledWith({ reference: 'r' }, 's3');
    expect(r.body).toEqual({ status: 200, data: { id: 1, leadId: 5, status: 'QUALIFIED', quality: 'HIGH', score: 90 } });
  });

  it('translates the domain errors', async () => {
    domain.receiveResult.mockRejectedValue(new AppError(HttpCode.UNAUTHORIZED, 'Secreto inválido.'));
    expect((await request(app).post('/api/dapta/webhook').send({})).status).toBe(401);
  });
});
