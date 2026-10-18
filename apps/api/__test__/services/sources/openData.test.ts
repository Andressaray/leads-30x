// RNT, SECOP II and REPS (datos.gov.co) and the Socrata client.
import { createSocrataClient, literalSoql } from '~services/sources/socrata';
import { rntQuery, rntToCandidate } from '~services/sources/rnt';
import { secopQuery, secopToCandidate } from '~services/sources/secop';
import { repsQuery, repsToCandidate } from '~services/sources/reps';
import { getMunicipality } from '~utils/divipola';
import { rntRows, repsRows, secopRows } from '~mocks/services/sources.mock';

const rionegro = getMunicipality('05615')!;

describe('Socrata client', () => {
  it('pages until a page comes back incomplete', async () => {
    const urls: string[] = [];
    const fetchImpl = async (url: string) => {
      urls.push(url);
      const offset = Number(new URL(url).searchParams.get('$offset'));
      const n = offset === 0 ? 5000 : 3;
      return new Response(JSON.stringify(Array.from({ length: n }, (_, i) => ({ i }))), { status: 200 });
    };
    const query = createSocrataClient({ fetchImpl, appToken: 'tok' });
    const { rows, truncated } = await query('thwd-ivmp', { $where: "cod_mun='05615'" });
    expect(rows).toHaveLength(5003);
    expect(truncated).toBe(false);
    expect(urls).toHaveLength(2);
  });

  it('stops at the maximum and reports it', async () => {
    const fetchImpl = async () => new Response(JSON.stringify(Array.from({ length: 10 }, () => ({}))), { status: 200 });
    const { rows, truncated } = await createSocrataClient({ fetchImpl, maxRecords: 10 })('thwd-ivmp', {});
    expect(rows).toHaveLength(10);
    expect(truncated).toBe(true);
  });

  it('escapes quotes in literals and rejects odd dataset ids', async () => {
    expect(literalSoql("O'Neil")).toBe("'O''Neil'");
    await expect(createSocrataClient()('../etc', {})).rejects.toThrow('Dataset inválido');
  });
});

describe('RNT', () => {
  it('query and mapping', () => {
    expect(rntQuery('05615', ['BARES'])).toBe("cod_mun='05615' AND estado_rnt='ACTIVO' AND categoria in ('BARES')");
    expect(() => rntQuery('5615', [])).toThrow();
    const c = rntToCandidate(rntRows[0], rionegro);
    expect(c).toMatchObject({ source: 'rnt', externalId: '11001', nit: '900111222', lat: null, isIndividual: false, sourceCategory: 'RNT HOTEL' });
    expect(c.phones.map((t) => t.number)).toEqual(['+573005550201', '+576045550202']);
    expect(rntToCandidate(rntRows[2], rionegro).isIndividual).toBe(true);
  });
});

describe('SECOP II', () => {
  it('query: municipality by code, without individuals, UNSPSC prefixes', () => {
    expect(secopQuery('05615', ['72', '9011'], false)).toBe(
      "ubicacion like '%-05615' AND esta_activa='Si' AND tipo_empresa not like 'PERSONA NATURAL%' AND (codigo_categoria_principal like 'V1.72%' OR codigo_categoria_principal like 'V1.9011%')"
    );
    expect(secopQuery('05615', [], true)).toBe("ubicacion like '%-05615' AND esta_activa='Si'");
    expect(() => secopQuery('05615', ["72' OR 1=1"], false)).toThrow();
  });

  it('mapping: own website vs "No Provisto"', () => {
    expect(secopToCandidate(secopRows[0], rionegro)).toMatchObject({ nit: '901333444', websites: ['www.casaalborada.example.co'], emails: ['contacto@casaalborada.example.co'] });
    expect(secopToCandidate(secopRows[1], rionegro)).toMatchObject({ websites: [], socialLinks: [] });
  });
});

describe('REPS', () => {
  it('query and mapping', () => {
    expect(repsQuery('05615', false)).toBe("municipiosede='05615' AND tipoid='NI'");
    expect(repsQuery('05615', true)).toBe("municipiosede='05615'");
    const c = repsToCandidate(repsRows[0], rionegro);
    expect(c).toMatchObject({ nit: '900222333', name: 'IPS SALUD ORIENTE SEDE RIONEGRO', legalName: 'IPS SALUD ORIENTE S.A.S.', isIndividual: false });
    expect(repsToCandidate({ ...repsRows[0], tipoid: 'CC' }, rionegro)).toMatchObject({ nit: null, isIndividual: true });
  });
});
