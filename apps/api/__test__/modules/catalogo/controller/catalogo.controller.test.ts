import request from 'supertest';
import { bearer } from '../../../setup/auth';
import { crearApp } from '~config/app';

jest.mock('modules/busquedas/domain/busquedas.domain');

const app = crearApp();
// Todas las rutas /api piden sesión: este agente manda el token de Andres en cada petición.
const api = request.agent(app).set('Authorization', bearer());

describe('Catálogo', () => {
  it('GET /api/catalogo/categorias', async () => {
    const r = await api.get('/api/catalogo/categorias');
    expect(r.status).toBe(200);
    expect(r.body.data.map((c: { clave: string }) => c.clave)).toContain('hotel');
  });

  it('GET /api/catalogo/departamentos', async () => {
    const r = await api.get('/api/catalogo/departamentos');
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBe(33);
    expect(r.body.data).toEqual(expect.arrayContaining([{ codigo: '05', nombre: 'Antioquia' }]));
  });

  it('GET /api/catalogo/municipios filtra por departamento', async () => {
    const r = await api.get('/api/catalogo/municipios?q=granada&departamento=meta');
    expect(r.body.data).toEqual([expect.objectContaining({ codigo: '50313', departamento: 'Meta' })]);
  });

  it('departamento desconocido → 400', async () => {
    expect((await api.get('/api/catalogo/municipios?departamento=narnia')).status).toBe(400);
  });
});
