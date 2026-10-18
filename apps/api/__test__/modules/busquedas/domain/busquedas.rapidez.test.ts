// Pruebas de los mecanismos que acortan la espera: caché, topes de tiempo y modo en segundo plano.

import { BusquedasDomain } from 'modules/busquedas/domain/busquedas.domain';
import { LeadsDomain } from 'modules/leads/domain/leads.domain';
import { cargarEnvironment } from '~config/environment';
import { crearFuentes } from '~services/fuentes';
import { crearFuenteOsm } from '~services/fuentes/osm';
import { crearFuenteDane } from '~services/fuentes/dane';
import { CacheTtl } from '~utils/cacheTtl';
import { obtenerMunicipio } from '~utils/divipola';
import type { FuenteLeads, ResultadoFuente } from '~types/fuente.types';
import { crearRepositorioLeadsEnMemoria } from '~mocks/modules/leads/leads.repository.mock';
import { crearRepositorioBusquedasEnMemoria } from '~mocks/modules/busquedas/busquedas.repository.mock';
import { crearRedFalsa, respuestaDane } from '~mocks/services/fuentes.mock';

function preparar(opciones: { fuentes?: FuenteLeads[]; fuenteMaxMs?: number; cacheMs?: number } = {}) {
  const red = crearRedFalsa();
  const env = cargarEnvironment();
  env.osm.endpoints = ['https://overpass-a.test/api/interpreter', 'https://overpass-b.test/api/interpreter'];
  const busquedasRepo = crearRepositorioBusquedasEnMemoria();
  const dominio = new BusquedasDomain({
    repo: busquedasRepo,
    leads: new LeadsDomain(crearRepositorioLeadsEnMemoria()),
    fuentes: opciones.fuentes ?? crearFuentes(env, red.fetch),
    cache: new CacheTtl<ResultadoFuente>(opciones.cacheMs ?? 60000),
    fuenteMaxMs: opciones.fuenteMaxMs,
  });
  return { red, dominio, busquedasRepo };
}

const esperarA = async (cond: () => boolean, ms = 2000) => {
  const fin = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > fin) throw new Error('no se cumplió a tiempo');
    await new Promise((r) => setTimeout(r, 5));
  }
};

describe('caché de fuentes', () => {
  it('repetir la misma búsqueda no vuelve a consultar las fuentes', async () => {
    const { dominio, red } = preparar();
    await dominio.crear({ codigo: '05615', categoria: 'hotel' });
    const llamadas = red.llamadas.length;
    const r = await dominio.crear({ codigo: '05615', categoria: 'hotel' });
    expect(red.llamadas.length).toBe(llamadas);
    expect(r.resumen.porFuente.osm?.meta).toMatchObject({ cache: true });
    expect(r.resumen.leads).toBe(7);
    expect(r.resumen.nuevos).toBe(0);
  });

  it('otra categoría u otro municipio sí consultan; refrescar ignora la caché', async () => {
    const { dominio, red } = preparar();
    const deDane = () => red.llamadas.filter((l) => l.url.includes('dane')).length;
    await dominio.crear({ codigo: '05615', categoria: 'hotel', fuentes: ['dane'] });
    const porBusqueda = deDane(); // una consulta por cada CIIU de la categoría
    await dominio.crear({ codigo: '05615', categoria: 'hotel', fuentes: ['dane'] });
    expect(deDane()).toBe(porBusqueda);
    await dominio.crear({ codigo: '05615', categoria: 'hotel', fuentes: ['dane'], refrescar: true });
    await dominio.crear({ codigo: '05001', categoria: 'hotel', fuentes: ['dane'] });
    await dominio.crear({ codigo: '05615', categoria: 'restaurantes', fuentes: ['dane'] });
    expect(deDane()).toBeGreaterThan(3 * porBusqueda);
  });

  it('una fuente que falla no queda en caché', async () => {
    const { dominio, red } = preparar();
    red.fallar.osm = 'red';
    await dominio.crear({ codigo: '05615', categoria: 'hotel', fuentes: ['osm', 'dane'] });
    delete red.fallar.osm;
    const r = await dominio.crear({ codigo: '05615', categoria: 'hotel', fuentes: ['osm', 'dane'] });
    expect(r.resumen.porFuente.osm).toMatchObject({ estado: 'ok' });
    expect(r.resumen.porFuente.osm?.meta).not.toMatchObject({ cache: true });
  });
});

describe('topes de tiempo', () => {
  it('una fuente que no responde se corta en fuenteMaxMs y las demás se guardan', async () => {
    const env = cargarEnvironment();
    const red = crearRedFalsa();
    const colgada: FuenteLeads = { nombre: 'osm', descripcion: 'colgada', buscar: () => new Promise(() => undefined) };
    const fuentes = crearFuentes(env, red.fetch).map((f) => (f.nombre === 'osm' ? colgada : f));
    const { dominio } = preparar({ fuentes, fuenteMaxMs: 50 });
    const inicio = Date.now();
    const r = await dominio.crear({ codigo: '05615', categoria: 'hotel', fuentes: ['osm', 'dane'] });
    expect(Date.now() - inicio).toBeLessThan(1000);
    expect(r.estado).toBe('parcial');
    expect(r.resumen.porFuente.osm).toMatchObject({ estado: 'error', error: expect.stringContaining('no respondió') });
  });

  it('OSM deja de probar servidores cuando se acaba su presupuesto total', async () => {
    let t = 0;
    const hosts: string[] = [];
    const osm = crearFuenteOsm({
      endpoints: ['https://a.test', 'https://b.test', 'https://c.test'],
      timeoutMs: 30000,
      presupuestoMs: 45000,
      pausaReintentoMs: 1,
      ahora: () => t,
      fetchImpl: async (url) => {
        hosts.push(new URL(url).host);
        t += 30000; // cada servidor "tarda" 30 s y responde 504
        return new Response('Gateway Timeout', { status: 504 });
      },
    });
    await expect(osm.buscar(obtenerMunicipio('05615')!, { aplica: true, valores: ['tourism=hotel'] }, { incluirPersonasNaturales: false })).rejects.toThrow(
      'Overpass no respondió'
    );
    expect(hosts).toEqual(['a.test', 'b.test']); // al tercero ya no le alcanza el tiempo
  });

  it('a Overpass nunca se le pide más tiempo del que queda', async () => {
    const consultas: string[] = [];
    const osm = crearFuenteOsm({
      endpoints: ['https://a.test'],
      timeoutMs: 60000,
      presupuestoMs: 20000,
      fetchImpl: async (_url, init) => {
        consultas.push(new URLSearchParams(String(init?.body)).get('data') ?? '');
        return new Response(JSON.stringify({ elements: [{ type: 'relation', id: 1 }] }), { status: 200 });
      },
    });
    await osm.buscar(obtenerMunicipio('05615')!, { aplica: true, valores: ['tourism=hotel'] }, { incluirPersonasNaturales: false });
    const segundos = Number(/\[timeout:(\d+)\]/.exec(consultas[0])![1]);
    expect(segundos).toBeLessThanOrEqual(20);
  });
});

describe('DANE', () => {
  it('reintenta una vez si responde 500', async () => {
    let n = 0;
    const dane = crearFuenteDane({
      pausaReintentoMs: 1,
      fetchImpl: async () => {
        n += 1;
        return n === 1 ? new Response('error', { status: 500 }) : new Response(JSON.stringify(respuestaDane), { status: 200 });
      },
    });
    const r = await dane.buscar(obtenerMunicipio('05615')!, { aplica: true, valores: [] }, { incluirPersonasNaturales: false });
    expect(n).toBe(2);
    expect(r.candidatos).toHaveLength(3);
  });

  it('consulta varios CIIU a la vez, sin pasar del límite', async () => {
    let enCurso = 0;
    let maximo = 0;
    const dane = crearFuenteDane({
      consultasEnParalelo: 2,
      fetchImpl: async () => {
        enCurso += 1;
        maximo = Math.max(maximo, enCurso);
        await new Promise((r) => setTimeout(r, 10));
        enCurso -= 1;
        return new Response(JSON.stringify(respuestaDane), { status: 200 });
      },
    });
    await dane.buscar(obtenerMunicipio('05615')!, { aplica: true, valores: ['5511', '5512', '5513', '5519'] }, { incluirPersonasNaturales: false });
    expect(maximo).toBe(2);
  });
});

describe('BusquedasDomain.iniciar (segundo plano)', () => {
  it('responde de inmediato en_curso y termina en segundo plano', async () => {
    const { dominio, busquedasRepo } = preparar();
    const inicio = await dominio.iniciar({ codigo: '05615', categoria: 'hotel' });
    expect(inicio).toMatchObject({ busquedaId: 1, estado: 'en_curso', municipio: { codigo: '05615' } });
    await esperarA(() => busquedasRepo._estado.busquedas[0].estado !== 'en_curso');
    const b = await dominio.obtener(inicio.busquedaId);
    expect(b.estado).toBe('completa');
    expect(b.resumen?.leads).toBe(7);
  });

  it('valida antes de aceptar: ciudad inexistente → 404 sin registrar nada', async () => {
    const { dominio, busquedasRepo } = preparar();
    await expect(dominio.iniciar({ ciudad: 'Gotham' })).rejects.toMatchObject({ status: 404 });
    expect(busquedasRepo._estado.busquedas).toHaveLength(0);
  });

  it('si todas las fuentes fallan, queda guardada como fallida', async () => {
    const { dominio, red, busquedasRepo } = preparar();
    red.fallar = { dane: 'red', osm: 'red', datos: 'red' };
    const { busquedaId } = await dominio.iniciar({ codigo: '05615', categoria: 'hotel' });
    await esperarA(() => busquedasRepo._estado.busquedas[0].estado !== 'en_curso');
    expect((await dominio.obtener(busquedaId)).estado).toBe('fallida');
  });
});
