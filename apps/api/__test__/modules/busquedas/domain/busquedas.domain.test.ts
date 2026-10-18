// Pruebas unitarias del dominio de búsquedas: orquestación de las 5 fuentes y
// cruce entre ellas. Repositorios en memoria y red simulada: sin base ni internet.

import { BusquedasDomain } from 'modules/busquedas/domain/busquedas.domain';
import { LeadsDomain } from 'modules/leads/domain/leads.domain';
import { AppError } from '~response/index';
import { cargarEnvironment } from '~config/environment';
import { crearFuentes } from '~services/fuentes';
import { crearRepositorioLeadsEnMemoria } from '~mocks/modules/leads/leads.repository.mock';
import { crearRepositorioBusquedasEnMemoria } from '~mocks/modules/busquedas/busquedas.repository.mock';
import { crearRedFalsa, type RedFalsa } from '~mocks/services/fuentes.mock';

function preparar() {
  const red: RedFalsa = crearRedFalsa();
  const env = cargarEnvironment();
  env.osm.endpoints = ['https://overpass-a.test/api/interpreter', 'https://overpass-b.test/api/interpreter'];
  const leadsRepo = crearRepositorioLeadsEnMemoria();
  const busquedasRepo = crearRepositorioBusquedasEnMemoria();
  const fuentes = crearFuentes(env, red.fetch);
  const dominio = new BusquedasDomain({ repo: busquedasRepo, leads: new LeadsDomain(leadsRepo), fuentes });
  return { red, leadsRepo, busquedasRepo, dominio };
}

describe('BusquedasDomain.crear', () => {
  it('consulta las 5 fuentes, cruza los resultados y no duplica', async () => {
    const { dominio, leadsRepo } = preparar();
    const r = await dominio.crear({ ciudad: 'Rionegro', departamento: 'Antioquia', categoria: 'hoteles' });

    expect(r.estado).toBe('completa');
    expect(r.municipio.codigo).toBe('05615');
    const pf = r.resumen.porFuente;
    expect(pf.dane).toMatchObject({ estado: 'ok', registros: 3, nuevos: 3 });
    expect(pf.rnt).toMatchObject({ estado: 'ok', registros: 3, nuevos: 1, enriquecidos: 2, meta: { omitidos_personas_naturales: 1 } });
    expect(pf.secop).toMatchObject({ estado: 'ok', registros: 2, nuevos: 1, enriquecidos: 1 });
    expect(pf.reps).toMatchObject({ estado: 'omitida' });
    expect(pf.osm).toMatchObject({ estado: 'ok', registros: 6, nuevos: 2, enriquecidos: 3, sinCambios: 1 });

    expect(r.resumen).toMatchObject({ leads: 7, nuevos: 7, contactables: 5, enVariasFuentes: 4 });
    expect(leadsRepo._estado.leads).toHaveLength(7);

    // DANE (NIT) + RNT (contacto) + OSM (nombre comercial y coordenadas del local)
    const mirador = r.leads.find((l) => l.nit === '900111222')!;
    expect(mirador.nombre).toBe('HOTEL MIRADOR DEL ORIENTE');
    expect(mirador.razonSocial).toBe('HOTEL EL MIRADOR DEL ORIENTE SAS');
    expect(mirador.fuentes).toEqual(['dane', 'rnt', 'osm']);
    expect(mirador.fuenteOrigen).toBe('dane');
    expect(mirador.emails).toEqual(['reservas@mirador.example.co', 'gerencia@mirador.example.co']);
    expect(mirador.telefonos.map((t) => t.numero)).toEqual(['+573005550201', '+576045550202', '+576045550101']);
    expect(mirador.lat).toBe(6.15153);

    // Razón social ≠ nombre comercial, unidos por la placa (DANE + SECOP + OSM)
    const alborada = r.leads.find((l) => l.nit === '901333444')!;
    expect(alborada.nombre).toBe('Hostal Las Golondrinas');
    expect(alborada.fuentes).toEqual(['dane', 'secop', 'osm']);
    expect(alborada.sitiosWeb).toEqual(['www.casaalborada.example.co']);
    expect(alborada.canalPrincipal).toBe('whatsapp');

    // RNT sin coordenadas + OSM, unidos por la placa
    const turista = r.leads.find((l) => l.nit === '901777888')!;
    expect(turista.fuentes).toEqual(['rnt', 'osm']);
    expect(turista.lat).toBe(6.15451);

    // La persona natural del RNT no entra
    expect(leadsRepo._estado.leads.some((l) => l.nombre === 'APARTAMENTO LAS FLORES')).toBe(false);
  });

  it('repetir la búsqueda no crea leads nuevos', async () => {
    const { dominio, leadsRepo } = preparar();
    await dominio.crear({ ciudad: 'Rionegro', departamento: 'Antioquia', categoria: 'hotel' });
    const r = await dominio.crear({ codigo: '05615', categoria: 'hotel' });
    expect(r.resumen.leads).toBe(7);
    expect(r.resumen.nuevos).toBe(0);
    expect(r.resumen.porFuente.osm).toMatchObject({ nuevos: 0, sinCambios: 6 });
    expect(leadsRepo._estado.leads).toHaveLength(7);
  });

  it('con personas naturales incluidas, también guarda las del RNT', async () => {
    const { dominio } = preparar();
    const r = await dominio.crear({ codigo: '05615', categoria: 'hotel', fuentes: ['rnt'], incluirPersonasNaturales: true });
    expect(r.resumen.porFuente.rnt).toMatchObject({ registros: 4, nuevos: 4 });
    expect(r.leads.find((l) => l.nombre === 'APARTAMENTO LAS FLORES')?.esPersonaNatural).toBe(true);
  });

  it('solo envía a datos.gov.co filtros armados con valores validados', async () => {
    const { dominio, red } = preparar();
    await dominio.crear({ codigo: '05615', categoria: 'hotel', fuentes: ['rnt', 'secop'] });
    const where = (u: string) => new URL(u).searchParams.get('$where');
    const rnt = where(red.llamadas.find((l) => l.url.includes('thwd-ivmp'))!.url);
    expect(rnt).toContain("cod_mun='05615' AND estado_rnt='ACTIVO' AND categoria in ('ESTABLECIMIENTOS DE ALOJAMIENTO TURÍSTICO')");
    const secop = where(red.llamadas.find((l) => l.url.includes('qmzu-gj57'))!.url);
    expect(secop).toContain("ubicacion like '%-05615' AND esta_activa='Si' AND tipo_empresa not like 'PERSONA NATURAL%'");
    expect(secop).toContain("codigo_categoria_principal like 'V1.9011%'");
  });

  it('para salud consulta el REPS y descarta la extensión del teléfono', async () => {
    const { dominio, red } = preparar();
    const r = await dominio.crear({ codigo: '05615', categoria: 'salud', fuentes: ['reps'] });
    const ips = r.leads[0];
    expect(ips.nit).toBe('900222333');
    expect(ips.telefonos.map((t) => t.numero)).toEqual(['+576045550601', '+573005550801']);
    expect(new URL(red.llamadas[0].url).searchParams.get('$where')).toBe("municipiosede='05615' AND tipoid='NI'");
  });

  it('si una fuente falla, las demás se guardan y la búsqueda queda parcial', async () => {
    const { dominio, red } = preparar();
    red.fallar.osm = 'red';
    const r = await dominio.crear({ codigo: '05615', categoria: 'hotel' });
    expect(r.estado).toBe('parcial');
    expect(r.resumen.porFuente.osm).toMatchObject({ estado: 'error' });
    expect(r.resumen.porFuente.dane).toMatchObject({ estado: 'ok', nuevos: 3 });
  });

  it('si todas las fuentes fallan responde 502 con el detalle', async () => {
    const { dominio, red } = preparar();
    red.fallar = { dane: 'red', osm: 'red', datos: 'red' };
    await expect(dominio.crear({ codigo: '05615', categoria: 'hotel' })).rejects.toMatchObject({ status: 502 });
  });

  it('si Overpass responde 429 reintenta con el siguiente servidor', async () => {
    const { dominio, red } = preparar();
    red.fallar.osm = 429;
    const r = await dominio.crear({ codigo: '05615', categoria: 'hotel', fuentes: ['osm'] });
    expect(r.estado).toBe('completa');
    const hosts = red.llamadas.map((l) => new URL(l.url).host);
    expect(hosts).toEqual(['overpass-a.test', 'overpass-b.test']);
  });

  it('si el municipio no tiene límite en OSM busca en un radio', async () => {
    const { dominio, red } = preparar();
    red.osmSinLimite = true;
    const r = await dominio.crear({ ciudad: 'Abriaquí', categoria: 'hotel', fuentes: ['osm'] });
    expect(r.resumen.porFuente.osm?.meta).toMatchObject({ ambito: 'radio_4000m' });
    expect(red.llamadas.at(-1)!.body).toContain('around%3A4000%2C6.632282%2C-76.064304');
  });

  it('ciudad repetida → 409 con las opciones', async () => {
    const { dominio } = preparar();
    const error = await dominio.crear({ ciudad: 'Granada' }).catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(409);
    expect(error.details.candidatos.map((c: { codigo: string }) => c.codigo)).toEqual(['05313', '25312', '50313']);
  });

  it('errores de entrada: ciudad inexistente, categoría desconocida', async () => {
    const { dominio } = preparar();
    await expect(dominio.crear({ ciudad: 'Gotham' })).rejects.toMatchObject({ status: 404 });
    await expect(dominio.crear({ ciudad: 'Medellín', categoria: 'naves espaciales' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('BusquedasDomain.obtener / listar', () => {
  it('devuelve el detalle por fuente y 404 si no existe', async () => {
    const { dominio } = preparar();
    const { busquedaId } = await dominio.crear({ codigo: '05615', categoria: 'hotel', fuentes: ['dane'] });
    const b = await dominio.obtener(busquedaId);
    expect(b.estado).toBe('completa');
    expect(b.fuentes?.[0]).toMatchObject({ fuente: 'dane', nuevos: 3 });
    expect(await dominio.listar(10)).toHaveLength(1);
    await expect(dominio.obtener(999)).rejects.toMatchObject({ status: 404 });
  });
});
