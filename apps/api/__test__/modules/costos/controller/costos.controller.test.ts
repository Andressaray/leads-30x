import request from 'supertest';
import { CostosDomain } from 'modules/costos/domain/costos.domain';
import { crearApp } from '~config/app';
import { ADMIN, bearer } from '../../../setup/auth';

jest.mock('modules/costos/domain/costos.domain');
jest.mock('modules/busquedas/domain/busquedas.domain');

const app = crearApp();
const comoServicio = request.agent(app).set('Authorization', bearer());
const comoAdmin = request.agent(app).set('Authorization', bearer(ADMIN));
const dominio = (CostosDomain as jest.MockedClass<typeof CostosDomain>).mock.instances[0] as jest.Mocked<CostosDomain>;
const valido = { canal: 'Email', descripcion: 'Brevo', monto: 31000, desde: '2026-10-01', hasta: '2026-10-31' };

describe('/api/costos', () => {
  it('cualquiera con sesión los ve; filtra por periodo', async () => {
    dominio.listar.mockResolvedValue([]);
    expect((await comoServicio.get('/api/costos?desde=2026-10-01&hasta=2026-10-31')).status).toBe(200);
    expect(dominio.listar).toHaveBeenCalledWith({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect((await comoServicio.get('/api/costos?desde=ayer')).status).toBe(400);
  });

  it('solo un ADMIN crea, edita o borra', async () => {
    expect((await comoServicio.post('/api/costos').send(valido)).status).toBe(403);
    expect((await comoServicio.patch('/api/costos/1').send({ monto: 1 })).status).toBe(403);
    expect((await comoServicio.delete('/api/costos/1')).status).toBe(403);
    dominio.crear.mockResolvedValue({ id: 1 } as never);
    expect((await comoAdmin.post('/api/costos').send(valido)).status).toBe(201);
    expect(dominio.crear).toHaveBeenCalledWith(
      { canal: 'email', tipo: 'GASTO', descripcion: 'Brevo', monto: 31000, horas: undefined, valorHora: undefined, desde: '2026-10-01', hasta: '2026-10-31' },
      ADMIN
    );
    dominio.eliminar.mockResolvedValue();
    expect((await comoAdmin.delete('/api/costos/1')).body).toEqual({ status: 200, data: { id: 1 } });
  });

  it.each([
    [{ ...valido, canal: 'tiktok' }, 'canal'],
    [{ ...valido, monto: -5 }, 'monto'],
    [{ ...valido, desde: '2026-02-30' }, 'desde'],
    [{ ...valido, tipo: 'regalo' }, 'tipo'],
  ])('valida %j', async (body, campo) => {
    const r = await comoAdmin.post('/api/costos').send(body);
    expect(r.status).toBe(400);
    expect(r.body.details).toEqual({ campo });
  });
});
