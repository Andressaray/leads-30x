import { esFestivo, festivosColombia, inicioDeSemanaColombia, mismoDiaColombia, motivoFueraDeHorario } from '~utils/horarioContacto';

// Hora de Colombia = UTC-5: las 7:00 a. m. en Bogotá son las 12:00 UTC.
const bogota = (iso: string) => new Date(`${iso}-05:00`);

describe('festivos de Colombia', () => {
  it('calcula los 18 festivos de 2026 (calendario oficial)', () => {
    expect([...festivosColombia(2026)].sort()).toEqual([
      '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-18', '2026-06-08',
      '2026-06-15', '2026-06-29', '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16',
      '2026-12-08', '2026-12-25',
    ]);
  });

  it('traslada al lunes (Ley Emiliani) y respeta los fijos de 2025', () => {
    const f = festivosColombia(2025);
    expect(f.has('2025-03-24')).toBe(true); // San José (19 de marzo, miércoles) → lunes 24
    expect(f.has('2025-04-17') && f.has('2025-04-18')).toBe(true); // Jueves y Viernes Santo
    expect(f.has('2025-07-20')).toBe(true); // fijo aunque cae domingo
    expect(f.size).toBe(17); // el 6 de enero de 2025 ya era lunes
    expect(esFestivo({ anio: 2025, mes: 12, dia: 8 })).toBe(true);
    expect(esFestivo({ anio: 2025, mes: 12, dia: 9 })).toBe(false);
  });
});

describe('motivoFueraDeHorario (Ley 2300 de 2023, art. 3)', () => {
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
  ])('%s → %s', (hora, esperado) => {
    const motivo = motivoFueraDeHorario(bogota(hora));
    if (esperado === null) expect(motivo).toBeNull();
    else expect(motivo).toContain(esperado);
  });

  it('usa la hora de Colombia aunque el servidor esté en UTC', () => {
    // 2026-10-15 01:00 UTC = miércoles 14 a las 8:00 p. m. en Bogotá → fuera de horario
    expect(motivoFueraDeHorario(new Date('2026-10-15T01:00:00Z'))).toContain('Fuera del horario');
  });
});

describe('semana y día en Colombia', () => {
  it('la semana empieza el lunes a medianoche de Colombia', () => {
    expect(inicioDeSemanaColombia(bogota('2026-10-17T14:00')).toISOString()).toBe('2026-10-12T05:00:00.000Z');
    expect(inicioDeSemanaColombia(bogota('2026-10-12T00:30')).toISOString()).toBe('2026-10-12T05:00:00.000Z');
    expect(inicioDeSemanaColombia(bogota('2026-10-18T23:59')).toISOString()).toBe('2026-10-12T05:00:00.000Z');
  });

  it('mismo día según el calendario de Colombia, no el de UTC', () => {
    expect(mismoDiaColombia(bogota('2026-10-14T07:00'), bogota('2026-10-14T20:30'))).toBe(true);
    expect(mismoDiaColombia(bogota('2026-10-14T23:00'), bogota('2026-10-15T00:30'))).toBe(false);
  });
});
