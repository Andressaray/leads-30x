// Cálculo del CPL (punto 3) y de la comparación costo/calidad (punto 4). Función pura: recibe los
// conteos y los costos, y reparte. Reglas:
//
//   1. Cada costo se prorratea por días: si cubre 30 días y el periodo toma 10, cuenta 1/3.
//   2. Por FUENTE (dónde se encontró el lead), con los leads NUEVOS del periodo:
//        costo = directo de la fuente
//              + "general" repartido según cuántos leads trajo cada fuente
//              + costo de cada canal de contacto repartido según cuántos leads de la fuente se contactaron por él
//        CPL = costo / leads
//   3. Por CANAL DE CONTACTO (correo, WhatsApp, llamada, Dapta): el costo directo del canal.
//        costo por contacto = costo / leads contactados; costo por respuesta = costo / respondieron.
//   4. Calidad = calificación de Dapta (o manual): índice 0–100 y proporción de calidad ALTA.

import { FUENTES } from '~types/fuente.types';
import { CANALES_CONTACTO_COSTO, type CanalCosto } from 'modules/costos/types/costos.types';
import type {
  CanalMetrica,
  ContactosPorFuenteDTO,
  ConteoEmbudoDTO,
  CostoPeriodoDTO,
  DatosCanalDTO,
  DatosFuenteDTO,
  IndicadoresDTO,
  MetricaCanalDTO,
  MetricaFuenteDTO,
  MetricasDTO,
  PeriodoDTO,
} from '../types/metricas.types';

const DIA = 86_400_000;
const dia = (s: string) => Date.parse(`${s}T00:00:00Z`) / DIA;
const pesos = (n: number) => Math.round(n * 100) / 100;
const div = (a: number, b: number) => (b > 0 ? a / b : null);
const divPesos = (a: number, b: number) => (b > 0 ? pesos(a / b) : null);

/** Parte del costo que cae dentro del periodo (por días, ambos extremos inclusive). */
export function prorratear(c: CostoPeriodoDTO, p: Pick<PeriodoDTO, 'desde' | 'hasta'>): number {
  const total = dia(c.hasta) - dia(c.desde) + 1;
  const dentro = Math.min(dia(c.hasta), dia(p.hasta)) - Math.max(dia(c.desde), dia(p.desde)) + 1;
  if (total <= 0 || dentro <= 0) return 0;
  return (c.monto * dentro) / total;
}

/** Reparte un monto según pesos; si todos son 0, no reparte nada. */
function repartir(monto: number, pesosPorClave: Map<string, number>): Map<string, number> {
  const total = [...pesosPorClave.values()].reduce((a, b) => a + b, 0);
  const r = new Map<string, number>();
  if (total <= 0) return r;
  for (const [k, w] of pesosPorClave) r.set(k, (monto * w) / total);
  return r;
}

function indicadores(e: ConteoEmbudoDTO, costo: number): IndicadoresDTO {
  const indice = div(e.indiceSuma, e.calificados);
  return {
    tasaRespuesta: div(e.respondieron, e.contactados),
    indiceCalidad: indice === null ? null : Math.round(indice),
    tasaAlta: div(e.alta, e.calificados),
    costoPorRespuesta: divPesos(costo, e.respondieron),
    costoPorLeadAlta: divPesos(costo, e.alta),
  };
}

const VACIO: ConteoEmbudoDTO = { contactados: 0, respondieron: 0, interesados: 0, calificados: 0, alta: 0, indiceSuma: 0 };

export function calcularMetricas(entrada: {
  periodo: PeriodoDTO;
  fuentes: DatosFuenteDTO[];
  canales: DatosCanalDTO[];
  contactosPorFuente: ContactosPorFuenteDTO[];
  costos: CostoPeriodoDTO[];
}): MetricasDTO {
  const { periodo } = entrada;

  // 1. Costos del periodo por canal de costo.
  const costos: Partial<Record<CanalCosto, number>> = {};
  for (const c of entrada.costos) costos[c.canal] = (costos[c.canal] ?? 0) + prorratear(c, periodo);
  const costoDe = (k: CanalCosto) => costos[k] ?? 0;

  // 2. Por fuente. Se muestran las 5 fuentes aunque no hayan traído leads (para ver su costo).
  const datosFuente = new Map(entrada.fuentes.map((f) => [f.fuente, f]));
  const nombres = [...new Set([...FUENTES, ...datosFuente.keys()])];
  const filasFuente = nombres.map((fuente): DatosFuenteDTO => datosFuente.get(fuente) ?? { fuente, leads: 0, contactables: 0, ...VACIO });

  const generalPorFuente = repartir(costoDe('general'), new Map(filasFuente.map((f) => [f.fuente, f.leads])));
  const contactoPorFuente = new Map<string, number>();
  let sinAsignar = filasFuente.some((f) => f.leads > 0) ? 0 : costoDe('general');
  for (const canal of CANALES_CONTACTO_COSTO) {
    const pesosCanal = new Map(entrada.contactosPorFuente.filter((c) => c.canal === canal).map((c) => [c.fuente, c.leads]));
    const reparto = repartir(costoDe(canal), pesosCanal);
    if (!reparto.size) sinAsignar += costoDe(canal);
    for (const [fuente, monto] of reparto) contactoPorFuente.set(fuente, (contactoPorFuente.get(fuente) ?? 0) + monto);
  }

  const porFuente: MetricaFuenteDTO[] = filasFuente.map((f) => {
    const directo = costoDe(f.fuente as CanalCosto);
    const general = generalPorFuente.get(f.fuente) ?? 0;
    const contacto = contactoPorFuente.get(f.fuente) ?? 0;
    const total = directo + general + contacto;
    return {
      ...f,
      costo: { directo: pesos(directo), general: pesos(general), contacto: pesos(contacto), total: pesos(total) },
      cpl: divPesos(total, f.leads),
      ...indicadores(f, total),
    };
  });

  // 3. Por canal de contacto.
  const datosCanal = new Map(entrada.canales.map((c) => [c.canal, c]));
  const porCanal: MetricaCanalDTO[] = CANALES_CONTACTO_COSTO.map((canal: CanalMetrica) => {
    const d = datosCanal.get(canal) ?? { canal, contactos: 0, ...VACIO };
    const costo = costoDe(canal);
    return { ...d, leadsContactados: d.contactados, costo: pesos(costo), costoPorContacto: divPesos(costo, d.contactados), ...indicadores(d, costo) };
  });

  // 4. Totales (todos los costos del periodo, se hayan podido repartir o no).
  const costoTotal = Object.values(costos).reduce((a, b) => a + (b ?? 0), 0);
  const suma = (k: keyof DatosFuenteDTO) => filasFuente.reduce((a, f) => a + (f[k] as number), 0);
  const leads = suma('leads');
  const respondieron = suma('respondieron');
  const alta = suma('alta');
  const calificados = suma('calificados');
  const indice = div(suma('indiceSuma'), calificados);

  // Los leads sin costo cargado ni contacto quedan con costo 0; las fuentes sin leads con costo quedan con CPL null.
  return {
    periodo,
    totales: {
      leads,
      contactados: suma('contactados'),
      respondieron,
      calificados,
      alta,
      costoTotal: pesos(costoTotal),
      costoSinAsignar: pesos(sinAsignar),
      cpl: divPesos(costoTotal, leads),
      costoPorRespuesta: divPesos(costoTotal, respondieron),
      costoPorLeadAlta: divPesos(costoTotal, alta),
      indiceCalidad: indice === null ? null : Math.round(indice),
    },
    porFuente,
    porCanal,
    costos: Object.fromEntries(Object.entries(costos).map(([k, v]) => [k, pesos(v ?? 0)])),
  };
}
