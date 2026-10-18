// Pruebas unitarias de las reglas de cruce y de consulta de leads (repositorio en memoria).

import { LeadsDomain } from 'modules/leads/domain/leads.domain';
import { aceptaPorNombreYDistancia, canalPrincipal } from 'modules/leads/domain/leads.cruce';
import { obtenerMunicipio } from '~utils/divipola';
import type { Candidato } from '~types/fuente.types';
import { crearRepositorioLeadsEnMemoria } from '~mocks/modules/leads/leads.repository.mock';

const rionegro = obtenerMunicipio('05615')!;
const ctx = { municipio: rionegro, categoria: 'hotel', busquedaId: 1 };

function cand(p: Partial<Candidato> & Pick<Candidato, 'fuente' | 'idExterno'>): Candidato {
  return {
    nombre: null, razonSocial: null, nombreComercial: null, nit: null, codMpio: '05615', direccion: null,
    lat: null, lon: null, ciiu: null, categoriaFuente: null, telefonos: [], emails: [], sitiosWeb: [], redes: [],
    esPersonaNatural: null, crudo: {}, ...p,
  };
}

function preparar() {
  const repo = crearRepositorioLeadsEnMemoria();
  return { repo, dominio: new LeadsDomain(repo) };
}

describe('LeadsDomain.registrarCandidatos', () => {
  it('un nombre genérico ("Hotel") no se cruza con nada', async () => {
    const { dominio, repo } = preparar();
    await dominio.registrarCandidatos([cand({ fuente: 'dane', idExterno: '1', nombre: 'HOTEL SAS', nit: '900000001', lat: 6.15, lon: -75.37 })], ctx);
    const r = await dominio.registrarCandidatos([cand({ fuente: 'osm', idExterno: 'node/1', nombre: 'Hotel', lat: 6.15, lon: -75.37 })], ctx);
    expect(r.nuevos).toBe(1);
    expect(repo._estado.leads).toHaveLength(2);
  });

  it('dos registros distintos del DANE nunca se unen por nombre', async () => {
    const { dominio, repo } = preparar();
    await dominio.registrarCandidatos(
      [
        cand({ fuente: 'dane', idExterno: '900000001', nit: '900000001', razonSocial: 'GRUPO ANDINO DEL ORIENTE SAS', nombre: 'GRUPO ANDINO DEL ORIENTE SAS', lat: 6.15, lon: -75.37 }),
        cand({ fuente: 'dane', idExterno: '900000002', nit: '900000002', razonSocial: 'GRUPO ANDINO DEL ORIENTE ZOMAC SAS', nombre: 'GRUPO ANDINO DEL ORIENTE ZOMAC SAS', lat: 6.15, lon: -75.37 }),
      ],
      ctx
    );
    expect(repo._estado.leads).toHaveLength(2);
  });

  it('un teléfono compartido no une negocios con nombres y ubicaciones distintas', async () => {
    const { dominio, repo } = preparar();
    const tel = [{ numero: '+576045550000', tipo: 'fijo' as const }];
    await dominio.registrarCandidatos([cand({ fuente: 'osm', idExterno: 'node/1', nombre: 'Ferretería El Tornillo', telefonos: tel, lat: 6.15, lon: -75.37 })], ctx);
    await dominio.registrarCandidatos([cand({ fuente: 'rnt', idExterno: 'r1', nombre: 'HOTEL LOS PINOS', telefonos: tel })], ctx);
    expect(repo._estado.leads).toHaveLength(2);
  });

  it('la misma placa repetida en el lote (centro comercial) no sirve para cruzar', async () => {
    const { dominio, repo } = preparar();
    await dominio.registrarCandidatos([cand({ fuente: 'dane', idExterno: '900000003', nit: '900000003', nombre: 'COMERCIAL XYZ SAS', direccion: 'KR 43A 1 50' })], ctx);
    const r = await dominio.registrarCandidatos(
      [
        cand({ fuente: 'osm', idExterno: 'node/7', nombre: 'Tienda Uno', direccion: 'Carrera 43A # 1-50' }),
        cand({ fuente: 'osm', idExterno: 'node/8', nombre: 'Tienda Dos', direccion: 'Carrera 43A # 1-50' }),
      ],
      ctx
    );
    expect(r.nuevos).toBe(2);
    expect(repo._estado.leads).toHaveLength(3);
  });

  it('la misma empresa en dos municipios son dos leads', async () => {
    const { dominio, repo } = preparar();
    const medellin = obtenerMunicipio('05001')!;
    await dominio.registrarCandidatos([cand({ fuente: 'dane', idExterno: 'a', nit: '900000004', nombre: 'EMPRESA UNO SAS' })], ctx);
    await dominio.registrarCandidatos(
      [cand({ fuente: 'rnt', idExterno: 'b', nit: '900000004', nombre: 'EMPRESA UNO', codMpio: '05001' })],
      { ...ctx, municipio: medellin }
    );
    expect(repo._estado.leads.map((l) => l.codMpio).sort()).toEqual(['05001', '05615']);
  });

  it('sin coordenadas, cruza por nombre solo si hay un único candidato con 2+ palabras en común', async () => {
    const { dominio, repo } = preparar();
    await dominio.registrarCandidatos([cand({ fuente: 'osm', idExterno: 'node/9', nombre: 'Hostal Cielo Azul', lat: 6.15, lon: -75.37 })], ctx);
    const r = await dominio.registrarCandidatos(
      [cand({ fuente: 'rnt', idExterno: 'r9', nombre: 'HOSTAL CIELO AZUL', emails: ['cielo@azul.example.co'] })],
      ctx
    );
    expect(r.enriquecidos).toBe(1);
    expect(repo._estado.leads).toHaveLength(1);
    expect(repo._estado.apariciones.find((a) => a.idExterno === 'r9')?.coincidencia).toBe('nombre');
  });

  it('cuenta como omitidos los registros sin nombre', async () => {
    const { dominio } = preparar();
    const r = await dominio.registrarCandidatos([cand({ fuente: 'osm', idExterno: 'node/10' })], ctx);
    expect(r).toMatchObject({ registros: 1, omitidos: 1, nuevos: 0 });
  });
});

describe('LeadsDomain consultas', () => {
  it('obtener lanza 404 si no existe', async () => {
    const { dominio } = preparar();
    await expect(dominio.obtener(42)).rejects.toMatchObject({ status: 404 });
  });

  it('exportarCsv agrega BOM, encabezados y escapa comas', async () => {
    const { dominio } = preparar();
    await dominio.registrarCandidatos(
      [cand({ fuente: 'osm', idExterno: 'node/1', nombre: 'Café, Pan y Más', telefonos: [{ numero: '+573001112233', tipo: 'movil', whatsapp: true }], lat: 6.1, lon: -75.3 })],
      ctx
    );
    const csv = await dominio.exportarCsv({ limite: 100, pagina: 1 });
    const [encabezado, fila] = csv.slice(1).trim().split('\n');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(encabezado.startsWith('id,nombre,razon_social,nit')).toBe(true);
    expect(fila).toContain('"Café, Pan y Más"');
    expect(fila).toContain('+573001112233');
  });

  it('listar respeta filtros y paginación', async () => {
    const { dominio } = preparar();
    await dominio.registrarCandidatos(
      [
        cand({ fuente: 'osm', idExterno: 'n1', nombre: 'Uno Alfa', lat: 6.1, lon: -75.3, emails: ['a@b.co'] }),
        cand({ fuente: 'osm', idExterno: 'n2', nombre: 'Dos Beta', lat: 6.2, lon: -75.4 }),
      ],
      ctx
    );
    const r = await dominio.listar({ contactable: true, limite: 10, pagina: 1 });
    expect(r.total).toBe(1);
    expect(r.leads[0].nombre).toBe('Uno Alfa');
  });
});

describe('LeadsDomain.marcarContactado', () => {
  async function conUnLead() {
    const p = preparar();
    await p.dominio.registrarCandidatos([cand({ fuente: 'osm', idExterno: 'n1', nombre: 'Hotel Uno', lat: 6.1, lon: -75.3 })], ctx);
    return p;
  }

  it('asigna el lead a quien le da Contactar', async () => {
    const { dominio } = await conUnLead();
    const lead = await dominio.marcarContactado(1, 1);
    expect(lead).toMatchObject({ contactado: true, contactadoPorId: 1, contactadoPor: { fullName: 'Andres Saray' } });
    expect(lead.contactadoEn).toBeTruthy();
  });

  it('volver a darle Contactar el mismo usuario no cambia nada', async () => {
    const { dominio } = await conUnLead();
    const primero = await dominio.marcarContactado(1, 1);
    const segundo = await dominio.marcarContactado(1, 1);
    expect(segundo.contactadoEn).toEqual(primero.contactadoEn);
  });

  it('si ya lo contactó otra persona responde 409 y no lo reasigna', async () => {
    const { dominio, repo } = await conUnLead();
    await dominio.marcarContactado(1, 2);
    await expect(dominio.marcarContactado(1, 1)).rejects.toMatchObject({
      status: 409,
      message: 'Este lead ya lo contactó Camila Rojas.',
    });
    expect(repo._estado.leads[0].contactadoPorId).toBe(2);
  });

  it('404 si el lead no existe', async () => {
    const { dominio } = preparar();
    await expect(dominio.marcarContactado(42, 1)).rejects.toMatchObject({ status: 404 });
  });

  it('una búsqueda que enriquece el lead no borra quién lo contactó', async () => {
    const { dominio, repo } = await conUnLead();
    await dominio.marcarContactado(1, 1);
    await dominio.registrarCandidatos(
      [cand({ fuente: 'osm', idExterno: 'n1', nombre: 'Hotel Uno', lat: 6.1, lon: -75.3, emails: ['hola@hoteluno.co'] })],
      ctx
    );
    expect(repo._estado.leads[0]).toMatchObject({ emails: ['hola@hoteluno.co'], contactado: true, contactadoPorId: 1 });
  });

  it('listar con contactadoPorId trae solo los de esa persona', async () => {
    const { dominio } = preparar();
    await dominio.registrarCandidatos(
      [
        cand({ fuente: 'osm', idExterno: 'n1', nombre: 'Uno Alfa', lat: 6.1, lon: -75.3 }),
        cand({ fuente: 'osm', idExterno: 'n2', nombre: 'Dos Beta', lat: 6.2, lon: -75.4 }),
      ],
      ctx
    );
    await dominio.marcarContactado(1, 1);
    await dominio.marcarContactado(2, 2);
    expect((await dominio.listar({ contactado: true, limite: 10, pagina: 1 })).total).toBe(2);
    const mios = await dominio.listar({ contactado: true, contactadoPorId: 1, limite: 10, pagina: 1 });
    expect(mios.leads.map((l) => l.nombre)).toEqual(['Uno Alfa']);
  });
});

describe('reglas puras', () => {
  it('umbrales de nombre y distancia', () => {
    expect(aceptaPorNombreYDistancia({ puntaje: 1, comunes: 2, minimo: 2 }, 250)).toBe(true);
    expect(aceptaPorNombreYDistancia({ puntaje: 1, comunes: 1, minimo: 1 }, 100)).toBe(true);
    expect(aceptaPorNombreYDistancia({ puntaje: 1, comunes: 1, minimo: 1 }, 200)).toBe(false);
    expect(aceptaPorNombreYDistancia({ puntaje: 0.5, comunes: 1, minimo: 2 }, 10)).toBe(false);
  });

  it('canal principal: WhatsApp > móvil > fijo > correo > web > redes', () => {
    expect(canalPrincipal({ telefonos: [{ numero: '+576041', tipo: 'fijo' }, { numero: '+573001', tipo: 'movil' }], emails: [], sitiosWeb: [], redes: [] })).toBe('movil');
    expect(canalPrincipal({ telefonos: [], emails: [], sitiosWeb: [], redes: ['https://instagram.com/x'] })).toBe('red_social');
    expect(canalPrincipal({ telefonos: [], emails: [], sitiosWeb: [], redes: [] })).toBeNull();
  });
});
