import * as repositorioReal from '../repository/metricas.repository';
import * as costosRepositorioReal from 'modules/costos/repository/costos.repository';
import { AppError, HttpCode } from '~response/index';
import { horaColombia } from '~utils/horarioContacto';
import { calcularMetricas } from './metricas.calculo';
import type { MetricasDomainInterface } from './metricas.interface';
import type { MetricasDTO, PeriodoDTO } from '../types/metricas.types';

export type MetricasRepository = typeof repositorioReal;
export type CostosLectura = Pick<typeof costosRepositorioReal, 'findCostos'>;

const DIA = 86_400_000;
const MAX_DIAS = 3 * 366;
const ymd = (a: number, m: number, d: number) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Inicio de un día de Colombia (00:00 -05:00) como instante UTC. */
const inicioDia = (s: string) => new Date(Date.parse(`${s}T00:00:00Z`) + 5 * 3600_000);

export class MetricasDomain implements MetricasDomainInterface {
  constructor(
    private readonly repo: MetricasRepository = repositorioReal,
    private readonly costos: CostosLectura = costosRepositorioReal,
    private readonly ahora: () => Date = () => new Date()
  ) {}

  async calcular(filtros: { desde?: string; hasta?: string }): Promise<MetricasDTO> {
    const periodo = this.periodo(filtros);
    const inicio = inicioDia(periodo.desde);
    const fin = new Date(inicioDia(periodo.hasta).getTime() + DIA);
    const [fuentes, canales, contactosPorFuente, costos] = await Promise.all([
      this.repo.findDatosPorFuente(inicio, fin),
      this.repo.findDatosPorCanal(inicio, fin),
      this.repo.findContactosPorFuente(inicio, fin),
      this.costos.findCostos({ desde: periodo.desde, hasta: periodo.hasta }),
    ]);
    return calcularMetricas({ periodo, fuentes, canales, contactosPorFuente, costos });
  }

  /** Sin fechas: del 1 del mes en curso a hoy (en Colombia). */
  private periodo(f: { desde?: string; hasta?: string }): PeriodoDTO {
    const hoy = horaColombia(this.ahora());
    const hasta = f.hasta ?? ymd(hoy.anio, hoy.mes, hoy.dia);
    const desde = f.desde ?? ymd(hoy.anio, hoy.mes, 1);
    if (desde > hasta) throw new AppError(HttpCode.BAD_REQUEST, 'La fecha "desde" no puede ser posterior a "hasta".', { campo: 'desde' });
    const dias = Math.round((Date.parse(hasta) - Date.parse(desde)) / DIA) + 1;
    if (dias > MAX_DIAS) throw new AppError(HttpCode.BAD_REQUEST, 'El periodo puede ser de máximo 3 años.', { campo: 'desde' });
    return { desde, hasta, dias };
  }
}
