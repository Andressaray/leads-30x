import { CostosDomain, prepararCosto, type CostosRepository } from 'modules/costos/domain/costos.domain';
import { AppError, HttpCode } from '~response/index';
import type { CostoDTO } from 'modules/costos/types/costos.types';

const ADMIN = { id: 3, email: 'admin@gmail.com', fullName: 'Administrador', rol: 'ADMIN' as const };
const existente: CostoDTO = {
  id: 1, canal: 'email', tipo: 'GASTO', descripcion: 'Brevo', monto: 31000, horas: null, valorHora: null,
  desde: '2026-10-01', hasta: '2026-10-31', creadoPorId: 3, createdAt: new Date(),
};

function repo(): jest.Mocked<CostosRepository> {
  return {
    findCostos: jest.fn().mockResolvedValue([existente]),
    findCosto: jest.fn(async (id: number) => (id === 1 ? existente : null)),
    createCosto: jest.fn(async (d) => ({ ...existente, ...d, id: 2 })),
    updateCosto: jest.fn(async (id, d) => ({ ...existente, ...d, id })),
    deleteCosto: jest.fn(),
  };
}

const status = (fn: () => unknown) => {
  try {
    fn();
    return 0;
  } catch (e) {
    return e instanceof AppError ? e.status : -1;
  }
};

describe('prepararCosto', () => {
  it('HORAS: monto = horas × valor de la hora', () => {
    expect(prepararCosto({ canal: 'rnt', tipo: 'HORAS', descripcion: 'x', horas: 2.5, valorHora: 31000, desde: '2026-10-01', hasta: '2026-10-01' }))
      .toMatchObject({ monto: 77500, horas: 2.5, valorHora: 31000 });
  });

  it('GASTO: ignora horas y valor de la hora', () => {
    expect(prepararCosto({ canal: 'email', tipo: 'GASTO', descripcion: 'x', monto: 10.004, horas: 3, desde: '2026-10-01', hasta: '2026-10-02' }))
      .toMatchObject({ monto: 10, horas: null, valorHora: null });
  });

  it('rechaza periodo al revés y montos faltantes', () => {
    expect(status(() => prepararCosto({ canal: 'email', tipo: 'GASTO', descripcion: 'x', monto: 1, desde: '2026-10-02', hasta: '2026-10-01' }))).toBe(HttpCode.BAD_REQUEST);
    expect(status(() => prepararCosto({ canal: 'email', tipo: 'GASTO', descripcion: 'x', desde: '2026-10-01', hasta: '2026-10-01' }))).toBe(HttpCode.BAD_REQUEST);
    expect(status(() => prepararCosto({ canal: 'email', tipo: 'HORAS', descripcion: 'x', horas: 1, desde: '2026-10-01', hasta: '2026-10-01' }))).toBe(HttpCode.BAD_REQUEST);
  });
});

describe('CostosDomain', () => {
  it('crea con autor; edita combinando con lo actual (pasar a HORAS recalcula el monto)', async () => {
    const r = repo();
    const d = new CostosDomain(r);
    await d.crear({ canal: 'general', tipo: 'GASTO', descripcion: 'Servidor', monto: 93000, desde: '2026-10-01', hasta: '2026-10-31' }, ADMIN);
    expect(r.createCosto).toHaveBeenCalledWith(expect.objectContaining({ creadoPorId: 3, monto: 93000 }));
    await d.actualizar(1, { tipo: 'HORAS', horas: 4, valorHora: 25000 });
    expect(r.updateCosto).toHaveBeenCalledWith(1, expect.objectContaining({ canal: 'email', tipo: 'HORAS', monto: 100000 }));
  });

  it('editar o borrar uno que no existe → 404', async () => {
    const d = new CostosDomain(repo());
    await expect(d.actualizar(9, { monto: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(d.eliminar(9)).rejects.toMatchObject({ status: 404 });
  });
});
