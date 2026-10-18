import { construirUrlDane, daneACandidato, URL_DANE_POR_DEFECTO } from '~services/fuentes/dane';
import { obtenerMunicipio } from '~utils/divipola';

describe('fuente DANE', () => {
  it('solo envía códigos numéricos al servicio', () => {
    expect(construirUrlDane(URL_DANE_POR_DEFECTO, '05615', '5511')).toMatch(/cod_dpto=05&cod_mpio=05615&ciiu=5511$/);
    expect(() => construirUrlDane(URL_DANE_POR_DEFECTO, "05615' --")).toThrow();
    expect(() => construirUrlDane(URL_DANE_POR_DEFECTO, '05615', '55')).toThrow();
  });

  it('registro → candidato', () => {
    const c = daneACandidato(
      { NIT: '900111222', RAZON_SOCIAL: 'HOTEL EL MIRADOR SAS', NOMBRE_COMERCIAL: '', DIRECCION: 'CL 49 50 20', MUNI_ID_DPTO: '05', MUNI_ID_MPIO: '615', TELEFONO1: '', CIIU_ID_CIIU_4_V: '5511', LATITUD: '6.1514', LONGITUD: '-75.3735' },
      obtenerMunicipio('05615')!
    );
    expect(c).toMatchObject({ fuente: 'dane', idExterno: '900111222', codMpio: '05615', ciiu: '5511', nombre: 'HOTEL EL MIRADOR SAS', esPersonaNatural: false, telefonos: [] });
  });
});
