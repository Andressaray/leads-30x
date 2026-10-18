// CPL por fuente y por canal: prorrateo y reparto de costos, con números que se pueden revisar a mano.
import { calcularMetricas, prorratear } from 'modules/metricas/domain/metricas.calculo';
import type { ContactosPorFuenteDTO, CostoPeriodoDTO, DatosCanalDTO, DatosFuenteDTO } from 'modules/metricas/types/metricas.types';

const OCT = { desde: '2026-10-01', hasta: '2026-10-31', dias: 31 };
const vacio = { contactados: 0, respondieron: 0, interesados: 0, calificados: 0, alta: 0, indiceSuma: 0 };
const fuente = (f: string, p: Partial<DatosFuenteDTO>): DatosFuenteDTO => ({ fuente: f, leads: 0, contactables: 0, ...vacio, ...p });
const canal = (c: DatosCanalDTO['canal'], p: Partial<DatosCanalDTO>): DatosCanalDTO => ({ canal: c, contactos: 0, ...vacio, ...p });
const costo = (canal: CostoPeriodoDTO['canal'], monto: number, desde = '2026-10-01', hasta = '2026-10-31'): CostoPeriodoDTO => ({ canal, monto, desde, hasta });

describe('prorratear', () => {
  it('cuenta solo los días que caen en el periodo (extremos inclusive)', () => {
    expect(prorratear(costo('general', 3100), OCT)).toBe(3100);
    expect(prorratear(costo('general', 3100), { desde: '2026-10-01', hasta: '2026-10-10' })).toBeCloseTo(1000);
    expect(prorratear(costo('general', 3000, '2026-09-16', '2026-10-15'), OCT)).toBeCloseTo(1500); // 15 de 30 días
    expect(prorratear(costo('general', 500, '2026-11-01', '2026-11-30'), OCT)).toBe(0);
    expect(prorratear(costo('general', 70, '2026-10-31', '2026-10-31'), OCT)).toBe(70);
  });
});

describe('calcularMetricas', () => {
  const base = {
    periodo: OCT,
    fuentes: [
      fuente('osm', { leads: 30, contactables: 20, contactados: 10, respondieron: 4, interesados: 1, calificados: 4, alta: 1, indiceSuma: 200 }),
      fuente('rnt', { leads: 10, contactables: 10, contactados: 10, respondieron: 5, interesados: 3, calificados: 5, alta: 3, indiceSuma: 375 }),
    ],
    canales: [
      canal('email', { contactos: 25, contactados: 20, respondieron: 9, interesados: 4, calificados: 9, alta: 4, indiceSuma: 575 }),
      canal('dapta', { contactos: 5, contactados: 5, respondieron: 3, calificados: 3, alta: 1, indiceSuma: 160 }),
    ],
    contactosPorFuente: [
      { canal: 'email', fuente: 'osm', leads: 10 },
      { canal: 'email', fuente: 'rnt', leads: 10 },
      { canal: 'dapta', fuente: 'rnt', leads: 5 },
    ] as ContactosPorFuenteDTO[],
    costos: [costo('general', 40000), costo('email', 20000), costo('dapta', 50000), costo('rnt', 7000)],
  };

  it('por fuente: directo + general según leads + contacto según leads contactados por cada canal', () => {
    const m = calcularMetricas(base);
    const osm = m.porFuente.find((f) => f.fuente === 'osm')!;
    const rnt = m.porFuente.find((f) => f.fuente === 'rnt')!;
    // general 40.000 → 30:10 ; email 20.000 → 10:10 ; dapta 50.000 → todo a rnt
    expect(osm.costo).toEqual({ directo: 0, general: 30000, contacto: 10000, total: 40000 });
    expect(rnt.costo).toEqual({ directo: 7000, general: 10000, contacto: 60000, total: 77000 });
    expect(osm.cpl).toBe(1333.33);
    expect(rnt.cpl).toBe(7700);
    expect(rnt).toMatchObject({ tasaRespuesta: 0.5, indiceCalidad: 75, tasaAlta: 0.6, costoPorRespuesta: 15400, costoPorLeadAlta: 25666.67 });
  });

  it('siempre muestra las 5 fuentes y los 4 canales, aunque estén en cero', () => {
    const m = calcularMetricas(base);
    expect(m.porFuente.map((f) => f.fuente)).toEqual(['dane', 'osm', 'rnt', 'secop', 'reps']);
    expect(m.porFuente.find((f) => f.fuente === 'dane')).toMatchObject({ leads: 0, cpl: null, indiceCalidad: null, tasaRespuesta: null });
    expect(m.porCanal.map((c) => c.canal)).toEqual(['email', 'whatsapp', 'llamada', 'dapta']);
  });

  it('por canal: costo directo del canal sobre contactados, respuestas y leads de calidad alta', () => {
    const m = calcularMetricas(base);
    const email = m.porCanal.find((c) => c.canal === 'email')!;
    const dapta = m.porCanal.find((c) => c.canal === 'dapta')!;
    expect(email).toMatchObject({ costo: 20000, leadsContactados: 20, costoPorContacto: 1000, costoPorRespuesta: 2222.22, tasaRespuesta: 0.45, indiceCalidad: 64 });
    expect(dapta).toMatchObject({ costo: 50000, costoPorContacto: 10000, costoPorLeadAlta: 50000, indiceCalidad: 53 });
  });

  it('totales: suman todos los costos del periodo', () => {
    const m = calcularMetricas(base);
    expect(m.totales).toMatchObject({ leads: 40, costoTotal: 117000, costoSinAsignar: 0, cpl: 2925, respondieron: 9, alta: 4, indiceCalidad: 64 });
    expect(m.porFuente.reduce((a, f) => a + f.costo.total, 0)).toBeCloseTo(117000);
  });

  it('un canal con costo pero sin contactos, o costos generales sin leads, quedan "sin asignar"', () => {
    const m = calcularMetricas({ ...base, costos: [...base.costos, costo('whatsapp', 9000)] });
    expect(m.totales.costoSinAsignar).toBe(9000);
    expect(m.porCanal.find((c) => c.canal === 'whatsapp')).toMatchObject({ costo: 9000, costoPorContacto: null });

    const sinLeads = calcularMetricas({ ...base, fuentes: [], contactosPorFuente: [], costos: [costo('general', 1000), costo('email', 500)] });
    expect(sinLeads.totales).toMatchObject({ leads: 0, costoTotal: 1500, costoSinAsignar: 1500, cpl: null });
  });

  it('sin costos: todo en 0 y los CPL en 0 (no null) si hay leads', () => {
    const m = calcularMetricas({ ...base, costos: [] });
    expect(m.totales.costoTotal).toBe(0);
    expect(m.porFuente.find((f) => f.fuente === 'osm')?.cpl).toBe(0);
  });
});
