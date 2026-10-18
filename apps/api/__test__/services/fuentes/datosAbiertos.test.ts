// RNT, SECOP II y REPS (datos.gov.co) y el cliente Socrata.
import { crearClienteSocrata, literalSoql } from '~services/fuentes/socrata';
import { consultaRnt, rntACandidato } from '~services/fuentes/rnt';
import { consultaSecop, secopACandidato } from '~services/fuentes/secop';
import { consultaReps, repsACandidato } from '~services/fuentes/reps';
import { obtenerMunicipio } from '~utils/divipola';
import { filasRnt, filasReps, filasSecop } from '~mocks/services/fuentes.mock';

const rionegro = obtenerMunicipio('05615')!;

describe('cliente Socrata', () => {
  it('pagina hasta que una página viene incompleta', async () => {
    const urls: string[] = [];
    const fetchImpl = async (url: string) => {
      urls.push(url);
      const offset = Number(new URL(url).searchParams.get('$offset'));
      const n = offset === 0 ? 5000 : 3;
      return new Response(JSON.stringify(Array.from({ length: n }, (_, i) => ({ i }))), { status: 200 });
    };
    const consultar = crearClienteSocrata({ fetchImpl, appToken: 'tok' });
    const { filas, truncado } = await consultar('thwd-ivmp', { $where: "cod_mun='05615'" });
    expect(filas).toHaveLength(5003);
    expect(truncado).toBe(false);
    expect(urls).toHaveLength(2);
  });

  it('corta en el máximo y lo avisa', async () => {
    const fetchImpl = async () => new Response(JSON.stringify(Array.from({ length: 10 }, () => ({}))), { status: 200 });
    const { filas, truncado } = await crearClienteSocrata({ fetchImpl, maxRegistros: 10 })('thwd-ivmp', {});
    expect(filas).toHaveLength(10);
    expect(truncado).toBe(true);
  });

  it('escapa comillas en literales y rechaza ids de dataset raros', async () => {
    expect(literalSoql("O'Neil")).toBe("'O''Neil'");
    await expect(crearClienteSocrata()('../etc', {})).rejects.toThrow('Dataset inválido');
  });
});

describe('RNT', () => {
  it('consulta y mapeo', () => {
    expect(consultaRnt('05615', ['BARES'])).toBe("cod_mun='05615' AND estado_rnt='ACTIVO' AND categoria in ('BARES')");
    expect(() => consultaRnt('5615', [])).toThrow();
    const c = rntACandidato(filasRnt[0], rionegro);
    expect(c).toMatchObject({ fuente: 'rnt', idExterno: '11001', nit: '900111222', lat: null, esPersonaNatural: false, categoriaFuente: 'RNT HOTEL' });
    expect(c.telefonos.map((t) => t.numero)).toEqual(['+573005550201', '+576045550202']);
    expect(rntACandidato(filasRnt[2], rionegro).esPersonaNatural).toBe(true);
  });
});

describe('SECOP II', () => {
  it('consulta: municipio por código, sin personas naturales, prefijos UNSPSC', () => {
    expect(consultaSecop('05615', ['72', '9011'], false)).toBe(
      "ubicacion like '%-05615' AND esta_activa='Si' AND tipo_empresa not like 'PERSONA NATURAL%' AND (codigo_categoria_principal like 'V1.72%' OR codigo_categoria_principal like 'V1.9011%')"
    );
    expect(consultaSecop('05615', [], true)).toBe("ubicacion like '%-05615' AND esta_activa='Si'");
    expect(() => consultaSecop('05615', ["72' OR 1=1"], false)).toThrow();
  });

  it('mapeo: web propia vs "No Provisto"', () => {
    expect(secopACandidato(filasSecop[0], rionegro)).toMatchObject({ nit: '901333444', sitiosWeb: ['www.casaalborada.example.co'], emails: ['contacto@casaalborada.example.co'] });
    expect(secopACandidato(filasSecop[1], rionegro)).toMatchObject({ sitiosWeb: [], redes: [] });
  });
});

describe('REPS', () => {
  it('consulta y mapeo', () => {
    expect(consultaReps('05615', false)).toBe("municipiosede='05615' AND tipoid='NI'");
    expect(consultaReps('05615', true)).toBe("municipiosede='05615'");
    const c = repsACandidato(filasReps[0], rionegro);
    expect(c).toMatchObject({ nit: '900222333', nombre: 'IPS SALUD ORIENTE SEDE RIONEGRO', razonSocial: 'IPS SALUD ORIENTE S.A.S.', esPersonaNatural: false });
    expect(repsACandidato({ ...filasReps[0], tipoid: 'CC' }, rionegro)).toMatchObject({ nit: null, esPersonaNatural: true });
  });
});
