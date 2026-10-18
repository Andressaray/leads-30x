import { isHoliday, colombianHolidays, colombiaWeekStart, sameDayColombia, outsideHoursReason } from '~utils/contactHours';

// Colombia time = UTC-5: 7:00 a.m. in Bogotá is 12:00 UTC.
const bogota = (iso: string) => new Date(`${iso}-05:00`);

describe('Colombian holidays', () => {
  it('computes the 18 holidays of 2026 (official calendar)', () => {
    expect([...colombianHolidays(2026)].sort()).toEqual([
      '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-18', '2026-06-08',
      '2026-06-15', '2026-06-29', '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16',
      '2026-12-08', '2026-12-25',
    ]);
  });

  it('moves to Monday (Ley Emiliani) and respects the fixed ones of 2025', () => {
    const f = colombianHolidays(2025);
    expect(f.has('2025-03-24')).toBe(true); // San José (March 19, Wednesday) → Monday the 24th
    expect(f.has('2025-04-17') && f.has('2025-04-18')).toBe(true); // Holy Thursday and Good Friday
    expect(f.has('2025-07-20')).toBe(true); // fixed even though it falls on a Sunday
    expect(f.size).toBe(17); // January 6, 2025 was already a Monday
    expect(isHoliday({ year: 2025, month: 12, day: 8 })).toBe(true);
    expect(isHoliday({ year: 2025, month: 12, day: 9 })).toBe(false);
  });
});

describe('outsideHoursReason (Ley 2300 de 2023, art. 3)', () => {
  it.each([
    ['2026-10-14T07:00', null], // miércoles 7:00
    ['2026-10-14T18:59', null],
    ['2026-10-14T06:59', 'Fuera del horario'],
    ['2026-10-14T19:00', 'Fuera del horario'],
    ['2026-10-17T08:00', null], // sábado
    ['2026-10-17T14:59', null],
    ['2026-10-17T15:00', 'Fuera del horario'],
    ['2026-10-18T10:00', 'domingo'],
    ['2026-10-12T10:00', 'festivo'], // Día de la Raza (lunes festivo)
  ])('%s → %s', (hour, expected) => {
    const reason = outsideHoursReason(bogota(hour));
    if (expected === null) expect(reason).toBeNull();
    else expect(reason).toContain(expected);
  });

  it('uses Colombia time even if the server runs in UTC', () => {
    // 2026-10-15 01:00 UTC = Wednesday the 14th at 8:00 p.m. in Bogotá → outside legal hours
    expect(outsideHoursReason(new Date('2026-10-15T01:00:00Z'))).toContain('Fuera del horario');
  });
});

describe('week and day in Colombia', () => {
  it('the week starts on Monday at midnight Colombia time', () => {
    expect(colombiaWeekStart(bogota('2026-10-17T14:00')).toISOString()).toBe('2026-10-12T05:00:00.000Z');
    expect(colombiaWeekStart(bogota('2026-10-12T00:30')).toISOString()).toBe('2026-10-12T05:00:00.000Z');
    expect(colombiaWeekStart(bogota('2026-10-18T23:59')).toISOString()).toBe('2026-10-12T05:00:00.000Z');
  });

  it('same day according to the Colombian calendar, not UTC', () => {
    expect(sameDayColombia(bogota('2026-10-14T07:00'), bogota('2026-10-14T20:30'))).toBe(true);
    expect(sameDayColombia(bogota('2026-10-14T23:00'), bogota('2026-10-15T00:30'))).toBe(false);
  });
});
