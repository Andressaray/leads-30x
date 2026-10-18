import type { MetricasDTO } from '../types/metricas.types';

export interface MetricasDomainInterface {
  /** CPL por fuente y por canal, embudo y calidad del periodo (por defecto, el mes en curso). 400 si el periodo no es válido. */
  calcular(filtros: { desde?: string; hasta?: string }): Promise<MetricasDTO>;
}
