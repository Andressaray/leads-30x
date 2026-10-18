// Pruebas de integración de la capa HTTP de búsquedas (dominio simulado).
import request from 'supertest';
import { bearer } from '../../../setup/auth';
import { BusquedasDomain } from 'modules/busquedas/domain/busquedas.domain';
import { AppError, HttpCode } from '~response/index';
import { crearApp } from '~config/app';

jest.mock('modules/busquedas/domain/busquedas.domain');
jest.mock('modules/leads/domain/leads.domain');

const app = crearApp();
// Todas las rutas /api piden sesión: este agente manda el token de Andres en cada petición.
const api = request.agent(app).set('Authorization', bearer());
const dominio = (BusquedasDomain as jest.MockedClass<typeof BusquedasDomain>).mock.instances[0] as jest.Mocked<BusquedasDomain>;

describe('POST /api/busquedas', () => {
  it('201 y normaliza listas enviadas como texto', async () => {
    dominio.crear.mockResolvedValue({ busquedaId: 1 } as never);
    const r = await api
      .post('/api/busquedas')
      .send({ ciudad: 'Rionegro', departamento: 'Antioquia', ciiu: '4752,4663', fuentes: ['dane', 'osm'], incluirPersonasNaturales: false });
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ status: 201, data: { busquedaId: 1 } });
    expect(dominio.crear).toHaveBeenCalledWith({
      ciudad: 'Rionegro', departamento: 'Antioquia', ciiu: ['4752', '4663'], fuentes: ['dane', 'osm'], incluirPersonasNaturales: false,
    });
  });

  it('con asincrona: true responde 202 y no espera el resultado', async () => {
    dominio.iniciar.mockResolvedValue({ busquedaId: 3, estado: 'en_curso' } as never);
    const r = await api.post('/api/busquedas').send({ codigo: '05615', asincrona: true, refrescar: 'true' });
    expect(r.status).toBe(202);
    expect(r.body).toEqual({ status: 202, data: { busquedaId: 3, estado: 'en_curso' } });
    expect(dominio.iniciar).toHaveBeenCalledWith({ codigo: '05615', refrescar: true });
    expect(dominio.crear).not.toHaveBeenCalled();
  });

  it.each([
    [{}, 'Envía "ciudad"'],
    [{ ciudad: 'Rionegro', fuentes: ['google'] }, 'fuentes'],
    [{ ciudad: 'Rionegro', ciiu: ['47'] }, 'ciiu'],
    [{ codigo: '123' }, 'codigo'],
    [{ ciudad: 'Rionegro', osm: ['shop"];out;'] }, 'osm'],
  ])('rechaza %j con 400', async (cuerpo, texto) => {
    const r = await api.post('/api/busquedas').send(cuerpo);
    expect(r.status).toBe(400);
    expect(r.body.error).toContain(texto);
    expect(dominio.crear).not.toHaveBeenCalled();
  });

  it('JSON mal formado → 400', async () => {
    const r = await api.post('/api/busquedas').set('Content-Type', 'application/json').send('{"ciudad":');
    expect(r.status).toBe(400);
  });

  it('ciudad ambigua: 409 con las opciones en details', async () => {
    dominio.crear.mockRejectedValue(
      new AppError(HttpCode.CONFLICT, 'Hay 3 municipios llamados "Granada".', { candidatos: [{ codigo: '50313' }] })
    );
    const r = await api.post('/api/busquedas').send({ ciudad: 'Granada' });
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ status: 409, error: 'Hay 3 municipios llamados "Granada".', details: { candidatos: [{ codigo: '50313' }] } });
  });
});

describe('GET /api/busquedas', () => {
  it('lista y detalle', async () => {
    dominio.listar.mockResolvedValue([]);
    dominio.obtener.mockRejectedValue(new AppError(HttpCode.NOT_FOUND, 'Búsqueda no encontrada.'));
    expect((await api.get('/api/busquedas?limite=5')).body).toEqual({ status: 200, data: [] });
    expect(dominio.listar).toHaveBeenCalledWith(5);
    expect((await api.get('/api/busquedas/77')).status).toBe(404);
  });
});
