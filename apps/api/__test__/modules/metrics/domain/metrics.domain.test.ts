import { MetricsDomain, type CostsReader, type MetricsRepository } from 'modules/metrics/domain/metrics.domain';
import { AppError } from '~response/index';

function prepare(now = new Date('2026-10-18T03:00:00Z')) {
  const repo: jest.Mocked<MetricsRepository> = {
    findDataBySource: jest.fn().mockResolvedValue([]),
    findDataByChannel: jest.fn().mockResolvedValue([]),
    findContactsBySource: jest.fn().mockResolvedValue([]),
  };
  const costs: jest.Mocked<CostsReader> = { findCosts: jest.fn().mockResolvedValue([]) };
  return { repo, costs, domain: new MetricsDomain(repo, costs, () => now) };
}

describe('MetricsDomain.calculate', () => {
  it('without dates it uses the current month in Colombia time (Oct 17 22:00 in Bogotá = Oct 18 UTC)', async () => {
    const { domain, repo, costs } = prepare();
    const m = await domain.calculate({});
    expect(m.period).toEqual({ from: '2026-10-01', to: '2026-10-17', days: 17 });
    // [Oct 1 00:00, Oct 18 00:00) in Bogotá
    expect(repo.findDataBySource).toHaveBeenCalledWith(new Date('2026-10-01T05:00:00Z'), new Date('2026-10-18T05:00:00Z'));
    expect(costs.findCosts).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-17' });
  });

  it('validates the period', async () => {
    const { domain } = prepare();
    await expect(domain.calculate({ from: '2026-10-10', to: '2026-10-01' })).rejects.toBeInstanceOf(AppError);
    await expect(domain.calculate({ from: '2020-01-01', to: '2026-10-01' })).rejects.toThrow('3 años');
  });
});
