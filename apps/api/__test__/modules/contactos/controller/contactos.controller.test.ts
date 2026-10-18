import request from 'supertest';
import { ContactosDomain } from 'modules/contactos/domain/contactos.domain';
import { AppError, HttpCode } from '~response/index';
import { crearApp } from '~config/app';
import { ANDRES, bearer } from '../../../setup/auth';

// Un solo objeto simulado para todas las instancias (el módulo de calificaciones también crea una).
jest.mock('modules/contactos/domain/contactos.domain', () => {
  const unico = {
    ficha: jest.fn(), vistaPrevia: jest.fn(), enviarCorreo: jest.fn(), registrarContacto: jest.fn(), registrarRespuesta: jest.fn(),
    marcarNoContactar: jest.fn(), darseDeBaja: jest.fn(), exigirPermisoContacto: jest.fn(), registrarLlamadaExterna: jest.fn(),
    registrarRespuestaExterna: jest.fn(),
  };
  return { ContactosDomain: jest.fn(() => unico) };
});
jest.mock('modules/busquedas/domain/busquedas.domain');

const app = crearApp();
const api = request.agent(app).set('Authorization', bearer());
const dominio = new ContactosDomain() as jest.Mocked<ContactosDomain>;
const ok = { interaccion: { id: 1 }, lead: { id: 5 } } as never;

describe('contacto con sesión', () => {
  it('todas las rutas piden sesión', async () => {
    expect((await request(app).get('/api/leads/5/contacto')).status).toBe(401);
    expect((await request(app).post('/api/leads/5/correo').send({})).status).toBe(401);
  });

  it('GET /leads/:id/contacto', async () => {
    dominio.ficha.mockResolvedValue({ lead: { id: 5 } } as never);
    const r = await api.get('/api/leads/5/contacto');
    expect(r.status).toBe(200);
    expect(dominio.ficha).toHaveBeenCalledWith(5, ANDRES);
  });

  it('vista previa: pide plantilla o cuerpo', async () => {
    dominio.vistaPrevia.mockResolvedValue({ asunto: null, mensaje: 'x', pie: 'y' });
    expect((await api.post('/api/leads/5/contacto/vista-previa').send({})).status).toBe(400);
    expect((await api.post('/api/leads/5/contacto/vista-previa').send({ plantillaId: 2 })).status).toBe(200);
    expect(dominio.vistaPrevia).toHaveBeenCalledWith(5, { plantillaId: 2, asunto: undefined, cuerpo: undefined }, ANDRES);
  });

  it('POST /correo → 201; valida y traduce 422/502', async () => {
    dominio.enviarCorreo.mockResolvedValue(ok);
    const body = { para: 'a@b.co', asunto: 'Asunto', mensaje: 'Mensaje con suficiente texto' };
    expect((await api.post('/api/leads/5/correo').send(body)).status).toBe(201);
    expect(dominio.enviarCorreo).toHaveBeenCalledWith(5, { ...body, plantillaId: undefined }, ANDRES);

    expect((await api.post('/api/leads/5/correo').send({ ...body, para: 'no-es-correo' })).body.details).toEqual({ campo: 'para' });
    expect((await api.post('/api/leads/5/correo').send({ ...body, mensaje: 'corto' })).status).toBe(400);

    dominio.enviarCorreo.mockRejectedValueOnce(new AppError(HttpCode.UNPROCESSABLE_ENTITY, 'Fuera del horario', { regla: 'ley_2300' }));
    const r = await api.post('/api/leads/5/correo').send(body);
    expect(r.body).toEqual({ status: 422, error: 'Fuera del horario', details: { regla: 'ley_2300' } });
    dominio.enviarCorreo.mockRejectedValueOnce(new AppError(HttpCode.BAD_GATEWAY, 'SMTP'));
    expect((await api.post('/api/leads/5/correo').send(body)).status).toBe(502);
  });

  it('POST /interacciones: el correo no se registra a mano', async () => {
    dominio.registrarContacto.mockResolvedValue(ok);
    expect((await api.post('/api/leads/5/interacciones').send({ canal: 'whatsapp', mensaje: 'Hola' })).status).toBe(201);
    expect(dominio.registrarContacto).toHaveBeenCalledWith(5, expect.objectContaining({ canal: 'WHATSAPP', mensaje: 'Hola' }), ANDRES);
    const r = await api.post('/api/leads/5/interacciones').send({ canal: 'EMAIL' });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain('/correo');
  });

  it('POST /respuesta', async () => {
    dominio.registrarRespuesta.mockResolvedValue(ok);
    expect((await api.post('/api/leads/5/respuesta').send({ canal: 'llamada', resultado: 'no_interesado' })).status).toBe(201);
    expect(dominio.registrarRespuesta).toHaveBeenCalledWith(5, { canal: 'LLAMADA', resultado: 'NO_INTERESADO', nota: undefined }, ANDRES);
    expect((await api.post('/api/leads/5/respuesta').send({ canal: 'EMAIL', resultado: 'PENDIENTE' })).status).toBe(400);
  });

  it('POST /no-contactar', async () => {
    dominio.marcarNoContactar.mockResolvedValue({ id: 5, noContactar: true } as never);
    expect((await api.post('/api/leads/5/no-contactar').send({ nota: 'Lo pidió' })).status).toBe(200);
    expect(dominio.marcarNoContactar).toHaveBeenCalledWith(5, 'Lo pidió', ANDRES);
  });

  it('no tapa las rutas del módulo de leads', async () => {
    expect((await api.get('/api/leads/abc/contacto')).status).toBe(400);
    expect(dominio.ficha).not.toHaveBeenCalled();
  });
});

describe('/api/bajas (público)', () => {
  it('GET solo muestra el botón; no da de baja', async () => {
    const r = await request(app).get('/api/bajas/5.AAAAAAAAAAAAAAAAAAAAAAAA');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/html');
    expect(r.text).toContain('method="post"');
    expect(dominio.darseDeBaja).not.toHaveBeenCalled();
  });

  it('POST da de baja sin sesión (botón o un clic de Gmail)', async () => {
    dominio.darseDeBaja.mockResolvedValue({ nombre: 'Café <Prueba>' });
    const r = await request(app).post('/api/bajas/5.AAAAAAAAAAAAAAAAAAAAAAAA').type('form').send('List-Unsubscribe=One-Click');
    expect(r.status).toBe(200);
    expect(r.text).toContain('Café &lt;Prueba&gt;');
    expect(dominio.darseDeBaja).toHaveBeenCalledWith('5.AAAAAAAAAAAAAAAAAAAAAAAA');
  });

  it('enlace inválido → página de error con el mismo código', async () => {
    dominio.darseDeBaja.mockRejectedValue(new AppError(HttpCode.NOT_FOUND, 'El enlace no es válido.'));
    const r = await request(app).post('/api/bajas/5.AAAAAAAAAAAAAAAAAAAAAAAA');
    expect(r.status).toBe(404);
    expect(r.text).toContain('Enlace no válido');
  });
});
