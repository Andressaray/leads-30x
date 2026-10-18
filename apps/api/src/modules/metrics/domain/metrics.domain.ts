import * as realRepository from '../repository/metrics.repository';
import * as realCostsRepository from 'modules/costs/repository/costs.repository';
import { AppError, HttpCode } from '~response/index';
import { colombiaTime } from '~utils/contactHours';
import { calculateMetrics } from './metrics.calculation';
import type { MetricsDomainInterface } from './metrics.interface';
import type { MetricsDTO, PeriodDTO } from '../types/metrics.types';

export type MetricsRepository = typeof realRepository;
export type CostsReader = Pick<typeof realCostsRepository, 'findCosts'>;

const DAY = 86_400_000;
const MAX_DAYS = 3 * 366;
const ymd = (a: number, m: number, d: number) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Start of a Colombian day (00:00 -05:00) as a UTC instant. */
const dayStart = (s: string) => new Date(Date.parse(`${s}T00:00:00Z`) + 5 * 3600_000);

export class MetricsDomain implements MetricsDomainInterface {
  constructor(
    private readonly repo: MetricsRepository = realRepository,
    private readonly costs: CostsReader = realCostsRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async calculate(filters: { from?: string; to?: string }): Promise<MetricsDTO> {
    const period = this.period(filters);
    const start = dayStart(period.from);
    const end = new Date(dayStart(period.to).getTime() + DAY);
    const [sources, channels, contactsBySource, costs] = await Promise.all([
      this.repo.findDataBySource(start, end),
      this.repo.findDataByChannel(start, end),
      this.repo.findContactsBySource(start, end),
      this.costs.findCosts({ from: period.from, to: period.to }),
    ]);
    return calculateMetrics({ period, sources, channels, contactsBySource, costs });
  }

  /** Without dates: from the 1st of the current month to today (in Colombia). */
  private period(f: { from?: string; to?: string }): PeriodDTO {
    const today = colombiaTime(this.now());
    const to = f.to ?? ymd(today.year, today.month, today.day);
    const from = f.from ?? ymd(today.year, today.month, 1);
    if (from > to) throw new AppError(HttpCode.BAD_REQUEST, 'La fecha "from" no puede ser posterior a "to".', { field: 'from' });
    const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
    if (days > MAX_DAYS) throw new AppError(HttpCode.BAD_REQUEST, 'El periodo puede ser de máximo 3 años.', { field: 'from' });
    return { from, to, days };
  }
}
