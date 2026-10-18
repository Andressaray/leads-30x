import request from 'supertest';
import { MetricsDomain } from 'modules/metrics/domain/metrics.domain';
import { createApp } from '~config/app';
import { bearer } from '../../../setup/auth';

jest.mock('modules/metrics/domain/metrics.domain');
jest.mock('modules/searches/domain/searches.domain');

const app = createApp();
const api = request.agent(app).set('Authorization', bearer());
const domain = (MetricsDomain as jest.MockedClass<typeof MetricsDomain>).mock.instances[0] as jest.Mocked<MetricsDomain>;

describe('GET /api/metrics', () => {
  it('passes the period and validates the dates', async () => {
    domain.calculate.mockResolvedValue({ totals: {} } as never);
    expect((await api.get('/api/metrics?from=2026-10-01&to=2026-10-31')).status).toBe(200);
    expect(domain.calculate).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-31' });
    expect((await api.get('/api/metrics')).status).toBe(200);
    expect(domain.calculate).toHaveBeenLastCalledWith({ from: undefined, to: undefined });
    expect((await api.get('/api/metrics?to=31-10-2026')).status).toBe(400);
    expect((await request(app).get('/api/metrics')).status).toBe(401);
  });
});
