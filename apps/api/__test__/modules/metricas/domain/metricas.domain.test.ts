import { MetricasDomain, type CostosLectura, type MetricasRepository } from 'modules/metricas/domain/metricas.domain';
import { AppError } from '~response/index';

function preparar(ahora = new Date('2026-10-18T03:00:00Z')) {
  const repo: jest.Mocked<MetricasRepository> = {
    findDatosPorFuente: jest.fn().mockResolvedValue([]),
    findDatosPorCanal: jest.fn().mockResolvedValue([]),
    findContactosPorFuente: jest.fn().mockResolvedValue([]),
  };
  const costos: jest.Mocked<CostosLectura> = { findCostos: jest.fn().mockResolvedValue([]) };
  return { repo, costos, dominio: new MetricasDomain(repo, costos, () => ahora) };
}

describe('MetricasDomain.calcular', () => {
  it('sin fechas usa el mes en curso en hora de Colombia (17-oct 22:00 en Bogotá = 18-oct UTC)', async () => {
    const { dominio, repo, costos } = preparar();
    const m = await dominio.calcular({});
    expect(m.periodo).toEqual({ desde: '2026-10-01', hasta: '2026-10-17', dias: 17 });
    // [1-oct 00:00, 18-oct 00:00) en Bogotá
    expect(repo.findDatosPorFuente).toHaveBeenCalledWith(new Date('2026-10-01T05:00:00Z'), new Date('2026-10-18T05:00:00Z'));
    expect(costos.findCostos).toHaveBeenCalledWith({ desde: '2026-10-01', hasta: '2026-10-17' });
  });

  it('valida el periodo', async () => {
    const { dominio } = preparar();
    await expect(dominio.calcular({ desde: '2026-10-10', hasta: '2026-10-01' })).rejects.toBeInstanceOf(AppError);
    await expect(dominio.calcular({ desde: '2020-01-01', hasta: '2026-10-01' })).rejects.toThrow('3 años');
  });
});
