// Capa HTTP de auth y usuarios (dominio simulado).
import request from 'supertest';
import { AuthDomain } from 'modules/auth/domain/auth.domain';
import { AppError, HttpCode } from '~response/index';
import { crearApp } from '~config/app';
import { ADMIN, ANDRES, bearer } from '../../../setup/auth';

jest.mock('modules/auth/domain/auth.domain');

const app = crearApp();
// Hay dos instancias: la del controller de auth y la del de usuarios (en ese orden de importación).
const [dominioAuth, dominioUsuarios] = (AuthDomain as jest.MockedClass<typeof AuthDomain>).mock.instances as jest.Mocked<AuthDomain>[];

describe('POST /api/auth/login', () => {
  it('responde el token y el usuario, normalizando el correo', async () => {
    dominioAuth.login.mockResolvedValue({ token: 't', usuario: ANDRES });
    const r = await request(app).post('/api/auth/login').send({ email: ' ANDRES@gmail.com ', password: 'Andres1234*' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 200, data: { token: 't', usuario: ANDRES } });
    expect(dominioAuth.login).toHaveBeenCalledWith({ email: 'andres@gmail.com', password: 'Andres1234*' });
  });

  it('credenciales malas → 401', async () => {
    dominioAuth.login.mockRejectedValue(new AppError(HttpCode.UNAUTHORIZED, 'Correo o contraseña incorrectos.'));
    const r = await request(app).post('/api/auth/login').send({ email: 'andres@gmail.com', password: 'x' });
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ status: 401, error: 'Correo o contraseña incorrectos.' });
  });

  it.each([
    [{ password: 'x' }, 'email'],
    [{ email: 'no-es-correo', password: 'x' }, 'email'],
    [{ email: 'andres@gmail.com' }, 'password'],
  ])('datos incompletos %j → 400', async (body, campo) => {
    const r = await request(app).post('/api/auth/login').send(body);
    expect(r.status).toBe(400);
    expect(r.body.details).toEqual({ campo });
    expect(dominioAuth.login).not.toHaveBeenCalled();
  });
});

describe('GET /api/auth/me', () => {
  it('pide sesión', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  it('devuelve el usuario de la sesión', async () => {
    dominioAuth.yo.mockResolvedValue({ ...ANDRES, activo: true, createdAt: new Date(), updatedAt: new Date() });
    const r = await request(app).get('/api/auth/me').set('Authorization', bearer(ANDRES));
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ email: 'andres@gmail.com' });
    expect(dominioAuth.yo).toHaveBeenCalledWith(ANDRES);
  });
});

describe('GET /api/usuarios/miembros', () => {
  it('pide sesión', async () => {
    expect((await request(app).get('/api/usuarios/miembros')).status).toBe(401);
  });

  it('cualquier usuario con sesión ve los miembros', async () => {
    const miembros = [{ id: 2, fullName: 'Camila Rojas', email: 'camila@gmail.com', contactados: 4 }];
    dominioUsuarios.listarMiembros.mockResolvedValue(miembros);
    const r = await request(app).get('/api/usuarios/miembros').set('Authorization', bearer(ANDRES));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 200, data: miembros });
  });
});

describe('GET /api/usuarios', () => {
  it('solo ADMIN: SERVICE recibe 403', async () => {
    const r = await request(app).get('/api/usuarios').set('Authorization', bearer(ANDRES));
    expect(r.status).toBe(403);
    expect(dominioUsuarios.listarUsuarios).not.toHaveBeenCalled();
  });

  it('ADMIN ve la lista', async () => {
    dominioUsuarios.listarUsuarios.mockResolvedValue([]);
    const r = await request(app).get('/api/usuarios').set('Authorization', bearer(ADMIN));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 200, data: [] });
  });
});
