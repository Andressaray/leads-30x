import { CostsDomain, prepareCost, type CostsRepository } from 'modules/costs/domain/costs.domain';
import { AppError, HttpCode } from '~response/index';
import type { CostDTO } from 'modules/costs/types/costs.types';

const ADMIN = { id: 3, email: 'admin@gmail.com', fullName: 'Administrador', role: 'ADMIN' as const };
const existing: CostDTO = {
  id: 1, channel: 'email', type: 'EXPENSE', description: 'Brevo', amount: 31000, hours: null, hourlyRate: null,
  from: '2026-10-01', to: '2026-10-31', createdById: 3, createdAt: new Date(),
};

function repo(): jest.Mocked<CostsRepository> {
  return {
    findCosts: jest.fn().mockResolvedValue([existing]),
    findCost: jest.fn(async (id: number) => (id === 1 ? existing : null)),
    createCost: jest.fn(async (d) => ({ ...existing, ...d, id: 2 })),
    updateCost: jest.fn(async (id, d) => ({ ...existing, ...d, id })),
    deleteCost: jest.fn(),
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

describe('prepareCost', () => {
  it('HOURS: amount = hours × hourly rate', () => {
    expect(prepareCost({ channel: 'rnt', type: 'HOURS', description: 'x', hours: 2.5, hourlyRate: 31000, from: '2026-10-01', to: '2026-10-01' }))
      .toMatchObject({ amount: 77500, hours: 2.5, hourlyRate: 31000 });
  });

  it('EXPENSE: ignores hours and hourly rate', () => {
    expect(prepareCost({ channel: 'email', type: 'EXPENSE', description: 'x', amount: 10.004, hours: 3, from: '2026-10-01', to: '2026-10-02' }))
      .toMatchObject({ amount: 10, hours: null, hourlyRate: null });
  });

  it('rejects reversed periods and missing amounts', () => {
    expect(status(() => prepareCost({ channel: 'email', type: 'EXPENSE', description: 'x', amount: 1, from: '2026-10-02', to: '2026-10-01' }))).toBe(HttpCode.BAD_REQUEST);
    expect(status(() => prepareCost({ channel: 'email', type: 'EXPENSE', description: 'x', from: '2026-10-01', to: '2026-10-01' }))).toBe(HttpCode.BAD_REQUEST);
    expect(status(() => prepareCost({ channel: 'email', type: 'HOURS', description: 'x', hours: 1, from: '2026-10-01', to: '2026-10-01' }))).toBe(HttpCode.BAD_REQUEST);
  });
});

describe('CostosDomain', () => {
  it('creates with author; edits by merging with the current values (switching to HOURS recalculates the amount)', async () => {
    const r = repo();
    const d = new CostsDomain(r);
    await d.create({ channel: 'general', type: 'EXPENSE', description: 'Servidor', amount: 93000, from: '2026-10-01', to: '2026-10-31' }, ADMIN);
    expect(r.createCost).toHaveBeenCalledWith(expect.objectContaining({ createdById: 3, amount: 93000 }));
    await d.update(1, { type: 'HOURS', hours: 4, hourlyRate: 25000 });
    expect(r.updateCost).toHaveBeenCalledWith(1, expect.objectContaining({ channel: 'email', type: 'HOURS', amount: 100000 }));
  });

  it('editing or deleting one that does not exist → 404', async () => {
    const d = new CostsDomain(repo());
    await expect(d.update(9, { amount: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(d.remove(9)).rejects.toMatchObject({ status: 404 });
  });
});
