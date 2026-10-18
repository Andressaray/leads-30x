import request from 'supertest';
import { CalificacionesDomain } from 'modules/calificaciones/domain/calificaciones.domain';
import { AppError, HttpCode } from '~response/index';
import { crearApp } from '~config/app';
import { ANDRES, bearer } from '../../../setup/auth';

jest.mock('modules/calificaciones/domain/calificaciones.domain', () => {
  const unico = { estado: jest.fn(), listar: jest.fn(), enviar: jest.fn(), enviarLote: jest.fn(), recibirResultado: jest.fn(), calificarManual: jest.fn() };
  return { CalificacionesDomain: jest.fn(() => unico), MAX_LOTE: 100 };
});
jest.mock('modules/busquedas/domain/busquedas.domain');

const app = crearApp();
const api = request.agent(app).set('Authorization', bearer());
const dominio = new CalificacionesDomain() as jest.Mocked<CalificacionesDomain>;

describe('rutas con sesión', () => {
  it('piden sesión', async () => {
    expect((await request(app).post('/api/leads/5/dapta')).status).toBe(401);
    expect((await request(app).get('/api/dapta/estado')).status).toBe(401);
    expect((await request(app).post('/api/dapta/envios').send({ leadIds: [1] })).status).toBe(401);
  });

  it('POST /leads/:id/dapta → 201 y traduce errores', async () => {
    dominio.enviar.mockResolvedValue({ id: 1 } as never);
    expect((await api.post('/api/leads/5/dapta')).status).toBe(201);
    expect(dominio.enviar).toHaveBeenCalledWith(5, ANDRES);
    dominio.enviar.mockRejectedValue(new AppError(HttpCode.SERVICE_UNAVAILABLE, 'Sin Dapta'));
    expect((await api.post('/api/leads/5/dapta')).body).toEqual({ status: 503, error: 'Sin Dapta' });
  });

  it('GET /leads/:id/calificaciones y POST /leads/:id/calificacion', async () => {
    dominio.listar.mockResolvedValue([]);
    expect((await api.get('/api/leads/5/calificaciones')).status).toBe(200);
    dominio.calificarManual.mockResolvedValue({ id: 2 } as never);
    expect((await api.post('/api/leads/5/calificacion').send({ calidad: 'media', puntaje: 50 })).status).toBe(201);
    expect(dominio.calificarManual).toHaveBeenCalledWith(5, { calidad: 'MEDIA', puntaje: 50, nota: undefined }, ANDRES);
    expect((await api.post('/api/leads/5/calificacion').send({ calidad: 'genial' })).status).toBe(400);
    expect((await api.post('/api/leads/5/calificacion').send({ calidad: 'ALTA', puntaje: 101 })).status).toBe(400);
  });

  it('POST /dapta/envios valida la lista', async () => {
    dominio.enviarLote.mockResolvedValue({ enviados: 1, omitidos: 0, resultados: [] });
    expect((await api.post('/api/dapta/envios').send({ leadIds: [1, '2'] })).status).toBe(200);
    expect(dominio.enviarLote).toHaveBeenCalledWith([1, 2], ANDRES);
    expect((await api.post('/api/dapta/envios').send({ leadIds: [] })).status).toBe(400);
    expect((await api.post('/api/dapta/envios').send({ leadIds: ['x'] })).status).toBe(400);
  });
});

describe('POST /api/dapta/webhook (sin sesión)', () => {
  beforeEach(() => dominio.recibirResultado.mockResolvedValue({ id: 1, leadId: 5, estado: 'CALIFICADO', calidad: 'ALTA', puntaje: 90 } as never));

  it('toma el secreto de la cabecera, del Bearer o de ?token', async () => {
    await request(app).post('/api/dapta/webhook').set('x-dapta-secret', 's1').send({ referencia: 'r' });
    expect(dominio.recibirResultado).toHaveBeenLastCalledWith({ referencia: 'r' }, 's1');
    await request(app).post('/api/dapta/webhook').set('Authorization', 'Bearer s2').send({ referencia: 'r' });
    expect(dominio.recibirResultado).toHaveBeenLastCalledWith({ referencia: 'r' }, 's2');
    const r = await request(app).post('/api/dapta/webhook?token=s3').send({ referencia: 'r' });
    expect(dominio.recibirResultado).toHaveBeenLastCalledWith({ referencia: 'r' }, 's3');
    expect(r.body).toEqual({ status: 200, data: { id: 1, leadId: 5, estado: 'CALIFICADO', calidad: 'ALTA', puntaje: 90 } });
  });

  it('traduce los errores del dominio', async () => {
    dominio.recibirResultado.mockRejectedValue(new AppError(HttpCode.UNAUTHORIZED, 'Secreto inválido.'));
    expect((await request(app).post('/api/dapta/webhook').send({})).status).toBe(401);
  });
});
