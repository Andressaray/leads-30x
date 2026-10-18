import type { MetricsDTO } from '../types/metrics.types';

export interface MetricsDomainInterface {
  /** CPL per source and per channel, funnel and quality of the period (the current month by default). 400 if the period is invalid. */
  calculate(filters: { from?: string; to?: string }): Promise<MetricsDTO>;
}
