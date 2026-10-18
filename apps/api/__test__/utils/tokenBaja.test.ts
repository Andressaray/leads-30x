import { crearTokenBaja, leerTokenBaja } from '~utils/tokenBaja';

const SECRETO = 'secreto-de-pruebas-secreto-de-pruebas';

describe('token de baja', () => {
  it('ida y vuelta', () => {
    expect(leerTokenBaja(crearTokenBaja(42, SECRETO), SECRETO)).toBe(42);
  });

  it('no sirve para otro lead ni con otro secreto', () => {
    const firma = crearTokenBaja(42, SECRETO).split('.')[1];
    expect(leerTokenBaja(`43.${firma}`, SECRETO)).toBeNull();
    expect(leerTokenBaja(crearTokenBaja(42, 'otro-secreto-otro-secreto-otro-secreto'), SECRETO)).toBeNull();
  });

  it.each(['', 'abc', '42', '42.', '42.corta', 'x.AAAAAAAAAAAAAAAAAAAAAAAA'])('rechaza "%s"', (t) => {
    expect(leerTokenBaja(t, SECRETO)).toBeNull();
  });
});
