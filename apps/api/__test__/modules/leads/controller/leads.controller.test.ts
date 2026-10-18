// Pruebas de integración de la capa HTTP de leads (dominio simulado).
import request from 'supertest';
import { ANDRES, bearer } from '../../../setup/auth';
import { LeadsDomain } from 'modules/leads/domain/leads.domain';
import { AppError, HttpCode } from '~response/index';
import { crearApp } from '~config/app';

jest.mock('modules/leads/domain/leads.domain');
jest.mock('modules/busquedas/domain/busquedas.domain');

const app = crearApp();
// Todas las rutas /api piden sesión: este agente manda el token de Andres en cada petición.
const api = request.agent(app).set('Authorization', bearer());
const dominio = (LeadsDomain as jest.MockedClass<typeof LeadsDomain>).mock.instances[0] as jest.Mocked<LeadsDomain>;

describe('GET /api/leads', () => {
  it('responde con el sobre { data, status } y pasa los filtros convertidos', async () => {
    dominio.listar.mockResolvedValue({ total: 0, pagina: 2, limite: 10, leads: [] });
    const r = await api.get('/api/leads?departamento=antioquia&contactable=true&limite=10&pagina=2&fuente=rnt');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 200, data: { total: 0, pagina: 2, limite: 10, leads: [] } });
    expect(dominio.listar).toHaveBeenCalledWith(
      expect.objectContaining({ codDpto: '05', contactable: true, limite: 10, pagina: 2, fuente: 'rnt' })
    );
  });

  it('mios=true filtra por el usuario de la sesión', async () => {
    dominio.listar.mockResolvedValue({ total: 0, pagina: 1, limite: 100, leads: [] });
    await api.get('/api/leads?contactado=true&mios=true');
    expect(dominio.listar).toHaveBeenCalledWith(expect.objectContaining({ contactado: true, contactadoPorId: ANDRES.id }));
  });

  it('sin mios trae los de todos; contactado_por filtra por un compañero', async () => {
    dominio.listar.mockResolvedValue({ total: 0, pagina: 1, limite: 100, leads: [] });
    await api.get('/api/leads?contactado=true');
    expect(dominio.listar).toHaveBeenLastCalledWith(expect.objectContaining({ contactado: true, contactadoPorId: undefined }));
    await api.get('/api/leads?contactado=true&contactado_por=2');
    expect(dominio.listar).toHaveBeenLastCalledWith(expect.objectContaining({ contactadoPorId: 2 }));
  });

  it('sin token o con token inválido → 401', async () => {
    expect((await request(app).get('/api/leads')).status).toBe(401);
    const r = await request(app).get('/api/leads').set('Authorization', 'Bearer no-es-un-jwt');
    expect(r.status).toBe(401);
    expect(dominio.listar).not.toHaveBeenCalled();
  });

  it.each([
    ['limite=0', 'limite'],
    ['contactado_por=abc', 'contactado_por'],
    ['departamento=narnia', 'departamento'],
    ['fuente=google', 'fuente'],
    ['municipio=5615', 'municipio'],
  ])('rechaza %s con 400', async (qs, campo) => {
    const r = await api.get(`/api/leads?${qs}`);
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ status: 400, details: { campo } });
    expect(dominio.listar).not.toHaveBeenCalled();
  });
});

describe('GET /api/leads/:id', () => {
  it('traduce AppError a su código', async () => {
    dominio.obtener.mockRejectedValue(new AppError(HttpCode.NOT_FOUND, 'Lead no encontrado.'));
    const r = await api.get('/api/leads/9');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ status: 404, error: 'Lead no encontrado.' });
  });

  it('un error inesperado responde 500 genérico', async () => {
    dominio.obtener.mockRejectedValue(new Error('se cayó la base'));
    const r = await api.get('/api/leads/9');
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ status: 500, error: 'Unknown error' });
  });

  it('id no numérico → 400', async () => {
    expect((await api.get('/api/leads/abc')).status).toBe(400);
  });
});

describe('POST /api/leads/:id/contactar', () => {
  it('marca el lead como contactado y responde con el sobre { data, status }', async () => {
    const lead = { id: 5, contactado: true, contactadoEn: new Date('2026-10-17T00:00:00.000Z') };
    dominio.marcarContactado.mockResolvedValue(lead as never);
    const r = await api.post('/api/leads/5/contactar');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe(200);
    expect(dominio.marcarContactado).toHaveBeenCalledWith(5, ANDRES.id);
  });

  it('si ya lo contactó otra persona → 409 con quién fue', async () => {
    const quien = { id: 2, fullName: 'Camila Rojas', email: 'camila@gmail.com' };
    dominio.marcarContactado.mockRejectedValue(
      new AppError(HttpCode.CONFLICT, 'Este lead ya lo contactó Camila Rojas.', { contactadoPor: quien, contactadoEn: null })
    );
    const r = await api.post('/api/leads/5/contactar');
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ error: 'Este lead ya lo contactó Camila Rojas.', details: { contactadoPor: quien } });
  });

  it('sin sesión → 401 y no marca nada', async () => {
    const r = await request(app).post('/api/leads/5/contactar');
    expect(r.status).toBe(401);
    expect(dominio.marcarContactado).not.toHaveBeenCalled();
  });

  it('id no numérico → 400', async () => {
    const r = await api.post('/api/leads/abc/contactar');
    expect(r.status).toBe(400);
    expect(dominio.marcarContactado).not.toHaveBeenCalled();
  });

  it('lead inexistente → 404', async () => {
    dominio.marcarContactado.mockRejectedValue(new AppError(HttpCode.NOT_FOUND, 'Lead no encontrado.'));
    const r = await api.post('/api/leads/999/contactar');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ status: 404, error: 'Lead no encontrado.' });
  });
});

describe('GET /api/leads/export.csv', () => {
  it('descarga un CSV', async () => {
    dominio.exportarCsv.mockResolvedValue('﻿id,nombre\n1,Hotel\n');
    const r = await api.get('/api/leads/export.csv?busqueda=3');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.headers['content-disposition']).toContain('leads.csv');
    expect(dominio.exportarCsv).toHaveBeenCalledWith(expect.objectContaining({ busquedaId: 3, limite: 100000 }));
  });
});

describe('rutas generales', () => {
  it('ruta inexistente → 404 con el sobre de error', async () => {
    const r = await api.get('/api/nada');
    expect(r.status).toBe(404);
    expect(r.body.status).toBe(404);
  });

  it('expone la documentación OpenAPI', async () => {
    const r = await api.get('/api/docs.json');
    expect(r.status).toBe(200);
    expect(Object.keys(r.body.paths)).toEqual(
      expect.arrayContaining(['/busquedas', '/leads', '/leads/{id}', '/catalogo/categorias', '/auth/login', '/auth/me', '/usuarios', '/usuarios/miembros'])
    );
  });
});
