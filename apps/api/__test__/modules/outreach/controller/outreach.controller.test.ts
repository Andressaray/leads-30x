import request from 'supertest';
import { OutreachDomain } from 'modules/outreach/domain/outreach.domain';
import { AppError, HttpCode } from '~response/index';
import { createApp } from '~config/app';
import { ANDRES, bearer } from '../../../setup/auth';

// A single mocked object for every instance (the qualifications module also creates one).
jest.mock('modules/outreach/domain/outreach.domain', () => {
  const unique = {
    sheet: jest.fn(), preview: jest.fn(), sendEmail: jest.fn(), recordContact: jest.fn(), recordReply: jest.fn(),
    markDoNotContact: jest.fn(), unsubscribe: jest.fn(), requireContactPermission: jest.fn(), recordExternalCall: jest.fn(),
    recordExternalReply: jest.fn(),
  };
  return { OutreachDomain: jest.fn(() => unique) };
});
jest.mock('modules/searches/domain/searches.domain');

const app = createApp();
const api = request.agent(app).set('Authorization', bearer());
const domain = new OutreachDomain() as jest.Mocked<OutreachDomain>;
const ok = { interaction: { id: 1 }, lead: { id: 5 } } as never;

describe('outreach with a session', () => {
  it('every route requires a session', async () => {
    expect((await request(app).get('/api/leads/5/contact')).status).toBe(401);
    expect((await request(app).post('/api/leads/5/email').send({})).status).toBe(401);
  });

  it('GET /leads/:id/contact', async () => {
    domain.sheet.mockResolvedValue({ lead: { id: 5 } } as never);
    const r = await api.get('/api/leads/5/contact');
    expect(r.status).toBe(200);
    expect(domain.sheet).toHaveBeenCalledWith(5, ANDRES);
  });

  it('preview: requires a template or a body', async () => {
    domain.preview.mockResolvedValue({ subject: null, message: 'x', footer: 'y' });
    expect((await api.post('/api/leads/5/contact/preview').send({})).status).toBe(400);
    expect((await api.post('/api/leads/5/contact/preview').send({ templateId: 2 })).status).toBe(200);
    expect(domain.preview).toHaveBeenCalledWith(5, { templateId: 2, subject: undefined, body: undefined }, ANDRES);
  });

  it('POST /email → 201; validates and translates 422/502', async () => {
    domain.sendEmail.mockResolvedValue(ok);
    const body = { to: 'a@b.co', subject: 'Asunto', message: 'Mensaje con suficiente texto' };
    expect((await api.post('/api/leads/5/email').send(body)).status).toBe(201);
    expect(domain.sendEmail).toHaveBeenCalledWith(5, { ...body, templateId: undefined }, ANDRES);

    expect((await api.post('/api/leads/5/email').send({ ...body, to: 'not-an-email' })).body.details).toEqual({ field: 'to' });
    expect((await api.post('/api/leads/5/email').send({ ...body, message: 'corto' })).status).toBe(400);

    domain.sendEmail.mockRejectedValueOnce(new AppError(HttpCode.UNPROCESSABLE_ENTITY, 'Fuera del horario', { rule: 'law_2300' }));
    const r = await api.post('/api/leads/5/email').send(body);
    expect(r.body).toEqual({ status: 422, error: 'Fuera del horario', details: { rule: 'law_2300' } });
    domain.sendEmail.mockRejectedValueOnce(new AppError(HttpCode.BAD_GATEWAY, 'SMTP'));
    expect((await api.post('/api/leads/5/email').send(body)).status).toBe(502);
  });

  it('POST /interactions: email is not recorded by hand', async () => {
    domain.recordContact.mockResolvedValue(ok);
    expect((await api.post('/api/leads/5/interactions').send({ channel: 'whatsapp', message: 'Hola' })).status).toBe(201);
    expect(domain.recordContact).toHaveBeenCalledWith(5, expect.objectContaining({ channel: 'WHATSAPP', message: 'Hola' }), ANDRES);
    const r = await api.post('/api/leads/5/interactions').send({ channel: 'EMAIL' });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain('/email');
  });

  it('POST /reply', async () => {
    domain.recordReply.mockResolvedValue(ok);
    expect((await api.post('/api/leads/5/reply').send({ channel: 'call', result: 'not_interested' })).status).toBe(201);
    expect(domain.recordReply).toHaveBeenCalledWith(5, { channel: 'CALL', result: 'NOT_INTERESTED', note: undefined }, ANDRES);
    expect((await api.post('/api/leads/5/reply').send({ channel: 'EMAIL', result: 'PENDING' })).status).toBe(400);
  });

  it('POST /do-not-contact', async () => {
    domain.markDoNotContact.mockResolvedValue({ id: 5, doNotContact: true } as never);
    expect((await api.post('/api/leads/5/do-not-contact').send({ note: 'Lo pidió' })).status).toBe(200);
    expect(domain.markDoNotContact).toHaveBeenCalledWith(5, 'Lo pidió', ANDRES);
  });

  it('does not shadow the leads module routes', async () => {
    expect((await api.get('/api/leads/abc/contact')).status).toBe(400);
    expect(domain.sheet).not.toHaveBeenCalled();
  });
});

describe('/api/unsubscribe (public)', () => {
  it('GET only shows the button; it does not unsubscribe', async () => {
    const r = await request(app).get('/api/unsubscribe/5.AAAAAAAAAAAAAAAAAAAAAAAA');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/html');
    expect(r.text).toContain('method="post"');
    expect(domain.unsubscribe).not.toHaveBeenCalled();
  });

  it('POST unsubscribes without a session (button or Gmail one-click)', async () => {
    domain.unsubscribe.mockResolvedValue({ name: 'Café <Prueba>' });
    const r = await request(app).post('/api/unsubscribe/5.AAAAAAAAAAAAAAAAAAAAAAAA').type('form').send('List-Unsubscribe=One-Click');
    expect(r.status).toBe(200);
    expect(r.text).toContain('Café &lt;Prueba&gt;');
    expect(domain.unsubscribe).toHaveBeenCalledWith('5.AAAAAAAAAAAAAAAAAAAAAAAA');
  });

  it('invalid link → error page with the same status code', async () => {
    domain.unsubscribe.mockRejectedValue(new AppError(HttpCode.NOT_FOUND, 'El enlace no es válido.'));
    const r = await request(app).post('/api/unsubscribe/5.AAAAAAAAAAAAAAAAAAAAAAAA');
    expect(r.status).toBe(404);
    expect(r.text).toContain('Enlace no válido');
  });
});
