import { MUNICIPALITIES, resolveDepartment, resolveMunicipality } from '~utils/divipola';

const code = (r: ReturnType<typeof resolveMunicipality>) => ('municipality' in r ? r.municipality.code : r);

describe('DIVIPOLA', () => {
  it('loads the 1,122 entities', () => {
    expect(MUNICIPALITIES).toHaveLength(1122);
  });

  it('aliases, accents and long official names', () => {
    expect(code(resolveMunicipality({ city: 'medellin' }))).toBe('05001');
    expect(code(resolveMunicipality({ city: 'Bogotá' }))).toBe('11001');
    expect(code(resolveMunicipality({ city: 'cali' }))).toBe('76001');
    expect(code(resolveMunicipality({ city: 'Cúcuta' }))).toBe('54001');
    expect(code(resolveMunicipality({ code: '05615' }))).toBe('05615');
  });

  it('repeated names require a department', () => {
    const r = resolveMunicipality({ city: 'Granada' });
    expect('candidates' in r && r.candidates.map((c) => c.code)).toEqual(['05313', '25312', '50313']);
    expect(code(resolveMunicipality({ city: 'Granada', department: 'Meta' }))).toBe('50313');
    expect(code(resolveMunicipality({ city: 'Rionegro', department: 'santander' }))).toBe('68615');
  });

  it('errors', () => {
    expect(resolveMunicipality({ city: 'Gotham' })).toEqual({ error: expect.stringContaining('No encontré') });
    expect(resolveMunicipality({ city: 'Granada', department: 'Narnia' })).toEqual({ error: expect.stringContaining('departamento') });
    expect(resolveDepartment('valle')).toBe('76');
    expect(resolveDepartment('')).toBeNull();
  });
});
