import { buildDaneUrl, daneToCandidate, DEFAULT_DANE_URL } from '~services/sources/dane';
import { getMunicipality } from '~utils/divipola';

describe('DANE source', () => {
  it('only sends numeric codes to the service', () => {
    expect(buildDaneUrl(DEFAULT_DANE_URL, '05615', '5511')).toMatch(/cod_dpto=05&cod_mpio=05615&ciiu=5511$/);
    expect(() => buildDaneUrl(DEFAULT_DANE_URL, "05615' --")).toThrow();
    expect(() => buildDaneUrl(DEFAULT_DANE_URL, '05615', '55')).toThrow();
  });

  it('record → candidate', () => {
    const c = daneToCandidate(
      { NIT: '900111222', RAZON_SOCIAL: 'HOTEL EL MIRADOR SAS', NOMBRE_COMERCIAL: '', DIRECCION: 'CL 49 50 20', MUNI_ID_DPTO: '05', MUNI_ID_MPIO: '615', TELEFONO1: '', CIIU_ID_CIIU_4_V: '5511', LATITUD: '6.1514', LONGITUD: '-75.3735' },
      getMunicipality('05615')!
    );
    expect(c).toMatchObject({ source: 'dane', externalId: '900111222', municipalityCode: '05615', ciiu: '5511', name: 'HOTEL EL MIRADOR SAS', isIndividual: false, phones: [] });
  });
});
