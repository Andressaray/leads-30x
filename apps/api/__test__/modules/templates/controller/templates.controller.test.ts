import request from 'supertest';
import { TemplatesDomain } from 'modules/templates/domain/templates.domain';
import { AppError, HttpCode } from '~response/index';
import { createApp } from '~config/app';
import { ANDRES, bearer } from '../../../setup/auth';

// A single mocked object for every instance (the outreach module also creates one).
jest.mock('modules/templates/domain/templates.domain', () => {
  const unique = { list: jest.fn(), get: jest.fn(), create: jest.fn(), update: jest.fn() };
  return { TemplatesDomain: jest.fn(() => unique) };
});
jest.mock('modules/searches/domain/searches.domain');

const app = createApp();
const api = request.agent(app).set('Authorization', bearer());
const domain = new TemplatesDomain() as jest.Mocked<TemplatesDomain>;

describe('/api/templates', () => {
  it('lists with filters and requires a session', async () => {
    domain.list.mockResolvedValue([]);
    expect((await api.get('/api/templates?channel=whatsapp&inactive=true')).status).toBe(200);
    expect(domain.list).toHaveBeenCalledWith({ channel: 'WHATSAPP', includeInactive: true });
    expect((await request(app).get('/api/templates')).status).toBe(401);
  });

  it('available variables', async () => {
    const r = await api.get('/api/templates/variables');
    expect(r.body.data.map((v: { name: string }) => v.name)).toEqual(['nombre', 'municipio', 'departamento', 'categoria', 'remitente', 'empresa']);
  });

  it('creates (201) with the session user', async () => {
    domain.create.mockResolvedValue({ id: 1 } as never);
    const r = await api.post('/api/templates').send({ name: 'Correo', channel: 'email', subject: 'Hola', body: 'Un texto bastante largo' });
    expect(r.status).toBe(201);
    expect(domain.create).toHaveBeenCalledWith({ name: 'Correo', channel: 'EMAIL', subject: 'Hola', body: 'Un texto bastante largo' }, ANDRES);
  });

  it.each([
    [{ channel: 'EMAIL', body: 'Un texto bastante largo' }, 'name'],
    [{ name: 'X1', channel: 'SMS', body: 'Un texto bastante largo' }, 'channel'],
    [{ name: 'X1', channel: 'EMAIL', body: 'corto' }, 'body'],
  ])('validates %j → 400 (%s)', async (body, field) => {
    const r = await api.post('/api/templates').send(body);
    expect(r.status).toBe(400);
    expect(r.body.details).toEqual({ field });
    expect(domain.create).not.toHaveBeenCalled();
  });

  it('edits and translates AppErrors', async () => {
    domain.update.mockRejectedValue(new AppError(HttpCode.FORBIDDEN, 'No'));
    const r = await api.patch('/api/templates/3').send({ active: false });
    expect(r.status).toBe(403);
    expect(domain.update).toHaveBeenCalledWith(3, { active: false }, ANDRES);
    expect((await api.patch('/api/templates/3').send({ active: 'no' })).status).toBe(400);
  });
});
