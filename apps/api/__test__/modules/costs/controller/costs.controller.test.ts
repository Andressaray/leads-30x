import request from 'supertest';
import { CostsDomain } from 'modules/costs/domain/costs.domain';
import { createApp } from '~config/app';
import { ADMIN, bearer } from '../../../setup/auth';

jest.mock('modules/costs/domain/costs.domain');
jest.mock('modules/searches/domain/searches.domain');

const app = createApp();
const asService = request.agent(app).set('Authorization', bearer());
const asAdmin = request.agent(app).set('Authorization', bearer(ADMIN));
const domain = (CostsDomain as jest.MockedClass<typeof CostsDomain>).mock.instances[0] as jest.Mocked<CostsDomain>;
const valid = { channel: 'Email', description: 'Brevo', amount: 31000, from: '2026-10-01', to: '2026-10-31' };

describe('/api/costs', () => {
  it('anyone with a session can see them; filters by period', async () => {
    domain.list.mockResolvedValue([]);
    expect((await asService.get('/api/costs?from=2026-10-01&to=2026-10-31')).status).toBe(200);
    expect(domain.list).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-31' });
    expect((await asService.get('/api/costs?from=ayer')).status).toBe(400);
  });

  it('only an ADMIN creates, edits or deletes', async () => {
    expect((await asService.post('/api/costs').send(valid)).status).toBe(403);
    expect((await asService.patch('/api/costs/1').send({ amount: 1 })).status).toBe(403);
    expect((await asService.delete('/api/costs/1')).status).toBe(403);
    domain.create.mockResolvedValue({ id: 1 } as never);
    expect((await asAdmin.post('/api/costs').send(valid)).status).toBe(201);
    expect(domain.create).toHaveBeenCalledWith(
      { channel: 'email', type: 'EXPENSE', description: 'Brevo', amount: 31000, hours: undefined, hourlyRate: undefined, from: '2026-10-01', to: '2026-10-31' },
      ADMIN
    );
    domain.remove.mockResolvedValue();
    expect((await asAdmin.delete('/api/costs/1')).body).toEqual({ status: 200, data: { id: 1 } });
  });

  it.each([
    [{ ...valid, channel: 'tiktok' }, 'channel'],
    [{ ...valid, amount: -5 }, 'amount'],
    [{ ...valid, from: '2026-02-30' }, 'from'],
    [{ ...valid, type: 'regalo' }, 'type'],
  ])('validates %j', async (body, field) => {
    const r = await asAdmin.post('/api/costs').send(body);
    expect(r.status).toBe(400);
    expect(r.body.details).toEqual({ field });
  });
});
