import { MUNICIPIOS, resolverDepartamento, resolverMunicipio } from '~utils/divipola';

const codigo = (r: ReturnType<typeof resolverMunicipio>) => ('municipio' in r ? r.municipio.codigo : r);

describe('DIVIPOLA', () => {
  it('trae las 1.122 entidades', () => {
    expect(MUNICIPIOS).toHaveLength(1122);
  });

  it('alias, tildes y nombres oficiales largos', () => {
    expect(codigo(resolverMunicipio({ ciudad: 'medellin' }))).toBe('05001');
    expect(codigo(resolverMunicipio({ ciudad: 'Bogotá' }))).toBe('11001');
    expect(codigo(resolverMunicipio({ ciudad: 'cali' }))).toBe('76001');
    expect(codigo(resolverMunicipio({ ciudad: 'Cúcuta' }))).toBe('54001');
    expect(codigo(resolverMunicipio({ codigo: '05615' }))).toBe('05615');
  });

  it('nombres repetidos piden departamento', () => {
    const r = resolverMunicipio({ ciudad: 'Granada' });
    expect('candidatos' in r && r.candidatos.map((c) => c.codigo)).toEqual(['05313', '25312', '50313']);
    expect(codigo(resolverMunicipio({ ciudad: 'Granada', departamento: 'Meta' }))).toBe('50313');
    expect(codigo(resolverMunicipio({ ciudad: 'Rionegro', departamento: 'santander' }))).toBe('68615');
  });

  it('errores', () => {
    expect(resolverMunicipio({ ciudad: 'Gotham' })).toEqual({ error: expect.stringContaining('No encontré') });
    expect(resolverMunicipio({ ciudad: 'Granada', departamento: 'Narnia' })).toEqual({ error: expect.stringContaining('departamento') });
    expect(resolverDepartamento('valle')).toBe('76');
    expect(resolverDepartamento('')).toBeNull();
  });
});
