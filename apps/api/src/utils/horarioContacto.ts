// Horario en que se puede contactar a un lead según la Ley 2300 de 2023 (art. 3):
//   lunes a viernes de 7:00 a. m. a 7:00 p. m. y sábados de 8:00 a. m. a 3:00 p. m.,
//   nunca domingos ni festivos. Siempre en hora de Colombia (UTC-5, sin horario de verano).

const ZONA = 'America/Bogota';
const DIA_MS = 86_400_000;

/** Fecha y hora "de pared" en Colombia. */
export interface HoraColombia {
  anio: number;
  mes: number; // 1-12
  dia: number;
  hora: number;
  minuto: number;
  /** 0 = domingo … 6 = sábado */
  diaSemana: number;
}

export function horaColombia(fecha: Date): HoraColombia {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(fecha);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  const dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    anio: Number(v('year')),
    mes: Number(v('month')),
    dia: Number(v('day')),
    hora: Number(v('hour')),
    minuto: Number(v('minute')),
    diaSemana: dias.indexOf(v('weekday')),
  };
}

/** Domingo de Pascua (algoritmo de Butcher/Meeus), como fecha UTC a medianoche. */
function domingoDePascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

const clave = (f: Date) => f.toISOString().slice(0, 10);
const masDias = (f: Date, n: number) => new Date(f.getTime() + n * DIA_MS);
/** Ley Emiliani (Ley 51 de 1983): si no cae lunes, se pasa al lunes siguiente. */
const alLunes = (f: Date) => masDias(f, (8 - f.getUTCDay()) % 7);

const cache = new Map<number, Set<string>>();

/** Festivos de Colombia de un año, como "AAAA-MM-DD". */
export function festivosColombia(anio: number): Set<string> {
  const guardado = cache.get(anio);
  if (guardado) return guardado;
  const fecha = (mes: number, dia: number) => new Date(Date.UTC(anio, mes - 1, dia));
  const pascua = domingoDePascua(anio);
  const lista = [
    // Fijos
    fecha(1, 1), fecha(5, 1), fecha(7, 20), fecha(8, 7), fecha(12, 8), fecha(12, 25),
    // Trasladables al lunes
    alLunes(fecha(1, 6)), alLunes(fecha(3, 19)), alLunes(fecha(6, 29)), alLunes(fecha(8, 15)),
    alLunes(fecha(10, 12)), alLunes(fecha(11, 1)), alLunes(fecha(11, 11)),
    // Semana Santa (fijos respecto a la Pascua)
    masDias(pascua, -3), masDias(pascua, -2),
    // Ascensión, Corpus Christi y Sagrado Corazón (trasladados al lunes)
    masDias(pascua, 43), masDias(pascua, 64), masDias(pascua, 71),
  ];
  const festivos = new Set(lista.map(clave));
  cache.set(anio, festivos);
  return festivos;
}

export function esFestivo(h: Pick<HoraColombia, 'anio' | 'mes' | 'dia'>): boolean {
  const k = `${h.anio}-${String(h.mes).padStart(2, '0')}-${String(h.dia).padStart(2, '0')}`;
  return festivosColombia(h.anio).has(k);
}

export const HORARIO_LEGAL_TEXTO = 'lunes a viernes de 7:00 a. m. a 7:00 p. m. y sábados de 8:00 a. m. a 3:00 p. m., sin domingos ni festivos';

/** null si se puede contactar a esta hora; si no, el motivo. */
export function motivoFueraDeHorario(fecha: Date): string | null {
  const h = horaColombia(fecha);
  const minutos = h.hora * 60 + h.minuto;
  if (esFestivo(h)) return `Hoy es festivo. Solo se puede contactar ${HORARIO_LEGAL_TEXTO} (Ley 2300 de 2023).`;
  if (h.diaSemana === 0) return `Hoy es domingo. Solo se puede contactar ${HORARIO_LEGAL_TEXTO} (Ley 2300 de 2023).`;
  const [desde, hasta] = h.diaSemana === 6 ? [8 * 60, 15 * 60] : [7 * 60, 19 * 60];
  if (minutos < desde || minutos >= hasta) {
    return `Fuera del horario permitido. Solo se puede contactar ${HORARIO_LEGAL_TEXTO} (Ley 2300 de 2023).`;
  }
  return null;
}

/** Mismo día calendario en Colombia. */
export function mismoDiaColombia(a: Date, b: Date): boolean {
  const x = horaColombia(a);
  const y = horaColombia(b);
  return x.anio === y.anio && x.mes === y.mes && x.dia === y.dia;
}

/** Lunes 00:00 (hora de Colombia) de la semana de esa fecha, como instante UTC. */
export function inicioDeSemanaColombia(fecha: Date): Date {
  const h = horaColombia(fecha);
  const diasDesdeLunes = (h.diaSemana + 6) % 7;
  // Medianoche en Colombia = 05:00 UTC.
  return new Date(Date.UTC(h.anio, h.mes - 1, h.dia - diasDesdeLunes, 5, 0, 0));
}
