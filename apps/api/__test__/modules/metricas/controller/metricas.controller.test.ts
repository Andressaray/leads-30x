import request from 'supertest';
import { MetricasDomain } from 'modules/metricas/domain/metricas.domain';
import { crearApp } from '~config/app';
import { bearer } from '../../../setup/auth';

jest.mock('modules/metricas/domain/metricas.domain');
jest.mock('modules/busquedas/domain/busquedas.domain');

const app = crearApp();
const api = request.agent(app).set('Authorization', bearer());
const dominio = (MetricasDomain as jest.MockedClass<typeof MetricasDomain>).mock.instances[0] as jest.Mocked<MetricasDomain>;

describe('GET /api/metricas', () => {
  it('pasa el periodo y valida las fechas', async () => {
    dominio.calcular.mockResolvedValue({ totales: {} } as never);
    expect((await api.get('/api/metricas?desde=2026-10-01&hasta=2026-10-31')).status).toBe(200);
    expect(dominio.calcular).toHaveBeenCalledWith({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect((await api.get('/api/metricas')).status).toBe(200);
    expect(dominio.calcular).toHaveBeenLastCalledWith({ desde: undefined, hasta: undefined });
    expect((await api.get('/api/metricas?hasta=31-10-2026')).status).toBe(400);
    expect((await request(app).get('/api/metricas')).status).toBe(401);
  });
});
