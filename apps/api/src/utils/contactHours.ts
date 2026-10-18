// Hours in which a lead can be contacted according to Ley 2300 de 2023 (art. 3):
//   Monday to Friday from 7:00 a.m. to 7:00 p.m. and Saturdays from 8:00 a.m. to 3:00 p.m.,
//   never on Sundays or holidays. Always in Colombia time (UTC-5, no daylight saving time).

const ZONE = 'America/Bogota';
const DAY_MS = 86_400_000;

/** "Wall clock" date and time in Colombia. */
export interface ColombiaTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

export function colombiaTime(date: Date): ColombiaTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    year: Number(v('year')),
    month: Number(v('month')),
    day: Number(v('day')),
    hour: Number(v('hour')),
    minute: Number(v('minute')),
    weekday: days.indexOf(v('weekday')),
  };
}

/** Easter Sunday (Butcher/Meeus algorithm), as a UTC date at midnight. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const key = (f: Date) => f.toISOString().slice(0, 10);
const addDays = (f: Date, n: number) => new Date(f.getTime() + n * DAY_MS);
/** Ley Emiliani (Ley 51 de 1983): if it does not fall on a Monday, it moves to the next Monday. */
const toMonday = (f: Date) => addDays(f, (8 - f.getUTCDay()) % 7);

const cache = new Map<number, Set<string>>();

/** Colombian holidays of a year, as "YYYY-MM-DD". */
export function colombianHolidays(year: number): Set<string> {
  const saved = cache.get(year);
  if (saved) return saved;
  const date = (month: number, day: number) => new Date(Date.UTC(year, month - 1, day));
  const easter = easterSunday(year);
  const list = [
    // Fixed
    date(1, 1), date(5, 1), date(7, 20), date(8, 7), date(12, 8), date(12, 25),
    // Moved to Monday
    toMonday(date(1, 6)), toMonday(date(3, 19)), toMonday(date(6, 29)), toMonday(date(8, 15)),
    toMonday(date(10, 12)), toMonday(date(11, 1)), toMonday(date(11, 11)),
    // Holy Week (fixed relative to Easter)
    addDays(easter, -3), addDays(easter, -2),
    // Ascension, Corpus Christi and Sacred Heart (moved to Monday)
    addDays(easter, 43), addDays(easter, 64), addDays(easter, 71),
  ];
  const holidays = new Set(list.map(key));
  cache.set(year, holidays);
  return holidays;
}

export function isHoliday(h: Pick<ColombiaTime, 'year' | 'month' | 'day'>): boolean {
  const k = `${h.year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`;
  return colombianHolidays(h.year).has(k);
}

export const LEGAL_HOURS_TEXT = 'lunes a viernes de 7:00 a. m. a 7:00 p. m. y sábados de 8:00 a. m. a 3:00 p. m., sin domingos ni festivos';

/** null if the lead can be contacted at this time; otherwise, the reason. */
export function outsideHoursReason(date: Date): string | null {
  const h = colombiaTime(date);
  const minutes = h.hour * 60 + h.minute;
  if (isHoliday(h)) return `Hoy es festivo. Solo se puede contactar ${LEGAL_HOURS_TEXT} (Ley 2300 de 2023).`;
  if (h.weekday === 0) return `Hoy es domingo. Solo se puede contactar ${LEGAL_HOURS_TEXT} (Ley 2300 de 2023).`;
  const [from, to] = h.weekday === 6 ? [8 * 60, 15 * 60] : [7 * 60, 19 * 60];
  if (minutes < from || minutes >= to) {
    return `Fuera del horario permitido. Solo se puede contactar ${LEGAL_HOURS_TEXT} (Ley 2300 de 2023).`;
  }
  return null;
}

/** Same calendar day in Colombia. */
export function sameDayColombia(a: Date, b: Date): boolean {
  const x = colombiaTime(a);
  const y = colombiaTime(b);
  return x.year === y.year && x.month === y.month && x.day === y.day;
}

/** Monday 00:00 (Colombia time) of that date's week, as a UTC instant. */
export function colombiaWeekStart(date: Date): Date {
  const h = colombiaTime(date);
  const daysSinceMonday = (h.weekday + 6) % 7;
  // Midnight in Colombia = 05:00 UTC.
  return new Date(Date.UTC(h.year, h.month - 1, h.day - daysSinceMonday, 5, 0, 0));
}
