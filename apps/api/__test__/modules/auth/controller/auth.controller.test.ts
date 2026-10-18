// HTTP layer of auth and users (simulated domain).
import request from 'supertest';
import { AuthDomain } from 'modules/auth/domain/auth.domain';
import { AppError, HttpCode } from '~response/index';
import { createApp } from '~config/app';
import { ADMIN, ANDRES, bearer } from '../../../setup/auth';

jest.mock('modules/auth/domain/auth.domain');

const app = createApp();
// There are two instances: the auth controller's and the users controller's (in that import order).
const [authDomain, usersDomain] = (AuthDomain as jest.MockedClass<typeof AuthDomain>).mock.instances as jest.Mocked<AuthDomain>[];

describe('POST /api/auth/login', () => {
  it('responds with the token and the user, normalizing the email', async () => {
    authDomain.login.mockResolvedValue({ token: 't', user: ANDRES });
    const r = await request(app).post('/api/auth/login').send({ email: ' ANDRES@gmail.com ', password: 'Andres1234*' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 200, data: { token: 't', user: ANDRES } });
    expect(authDomain.login).toHaveBeenCalledWith({ email: 'andres@gmail.com', password: 'Andres1234*' });
  });

  it('bad credentials → 401', async () => {
    authDomain.login.mockRejectedValue(new AppError(HttpCode.UNAUTHORIZED, 'Correo o contraseña incorrectos.'));
    const r = await request(app).post('/api/auth/login').send({ email: 'andres@gmail.com', password: 'x' });
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ status: 401, error: 'Correo o contraseña incorrectos.' });
  });

  it.each([
    [{ password: 'x' }, 'email'],
    [{ email: 'not-an-email', password: 'x' }, 'email'],
    [{ email: 'andres@gmail.com' }, 'password'],
  ])('incomplete data %j → 400', async (body, field) => {
    const r = await request(app).post('/api/auth/login').send(body);
    expect(r.status).toBe(400);
    expect(r.body.details).toEqual({ field });
    expect(authDomain.login).not.toHaveBeenCalled();
  });
});

describe('GET /api/auth/me', () => {
  it('requires a session', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  it('returns the session user', async () => {
    authDomain.me.mockResolvedValue({ ...ANDRES, active: true, createdAt: new Date(), updatedAt: new Date() });
    const r = await request(app).get('/api/auth/me').set('Authorization', bearer(ANDRES));
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ email: 'andres@gmail.com' });
    expect(authDomain.me).toHaveBeenCalledWith(ANDRES);
  });
});

describe('GET /api/users/members', () => {
  it('requires a session', async () => {
    expect((await request(app).get('/api/users/members')).status).toBe(401);
  });

  it('any user with a session sees the members', async () => {
    const members = [{ id: 2, fullName: 'Camila Rojas', email: 'camila@gmail.com', contacted: 4 }];
    usersDomain.listMembers.mockResolvedValue(members);
    const r = await request(app).get('/api/users/members').set('Authorization', bearer(ANDRES));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 200, data: members });
  });
});

describe('GET /api/users', () => {
  it('ADMIN only: SERVICE gets 403', async () => {
    const r = await request(app).get('/api/users').set('Authorization', bearer(ANDRES));
    expect(r.status).toBe(403);
    expect(usersDomain.listUsers).not.toHaveBeenCalled();
  });

  it('ADMIN sees the list', async () => {
    usersDomain.listUsers.mockResolvedValue([]);
    const r = await request(app).get('/api/users').set('Authorization', bearer(ADMIN));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 200, data: [] });
  });
});
