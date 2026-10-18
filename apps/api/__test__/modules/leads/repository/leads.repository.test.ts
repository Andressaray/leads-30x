// Pruebas de integración contra la base de pruebas real (DATABASE_URL_TEST).
import * as repo from 'modules/leads/repository/leads.repository';
import type { CreateLeadDTO } from 'modules/leads/types/leads.types';
import { crearBusquedaDePrueba, crearUsuarioDePrueba, describeConBase, limpiarBase, prisma } from '../../../setup/db';

function nuevoLead(p: Partial<CreateLeadDTO> = {}): CreateLeadDTO {
  return {
    nombre: 'Hotel Prueba', nombreComercial: 'Hotel Prueba', razonSocial: null, nombresNorm: 'hotel prueba', nit: null,
    codMpio: '05615', municipio: 'RIONEGRO', departamento: 'Antioquia', direccion: 'KR 50 46 23', direccionNorm: 'kr 50 46 23',
    lat: 6.1514, lon: -75.3735, ciiu: null, categoriaFuente: 'tourism=hotel', categorias: ['hotel'],
    telefonos: [{ numero: '+573001112233', tipo: 'movil', whatsapp: true }], emails: [], sitiosWeb: [], redes: [],
    canalPrincipal: 'whatsapp', contactable: true, esPersonaNatural: null, fuentes: ['osm'], numFuentes: 1,
    fuenteOrigen: 'osm', busquedaOrigenId: null, ...p,
  };
}

describeConBase('leads.repository', () => {
  beforeEach(limpiarBase);
  afterAll(() => prisma.$disconnect());

  it('crea, actualiza y conserva los teléfonos como JSON', async () => {
    const creado = await repo.createLead(nuevoLead());
    expect(creado.telefonos).toEqual([{ numero: '+573001112233', tipo: 'movil', whatsapp: true }]);
    const actualizado = await repo.updateLead(creado.id, { nit: '900000001', fuentes: ['osm', 'dane'], numFuentes: 2 });
    expect(actualizado).toMatchObject({ nit: '900000001', fuentes: ['osm', 'dane'], numFuentes: 2 });
  });

  it('claves: no duplica y encuentra el lead', async () => {
    const l = await repo.createLead(nuevoLead());
    expect(await repo.createClaves(l.id, [{ tipo: 'nit', valor: '05615|900000001' }, { tipo: 'nit', valor: '05615|900000001' }])).toBe(1);
    expect((await repo.findLeadByClave('nit', '05615|900000001'))?.id).toBe(l.id);
    expect(await repo.findLeadByClave('nit', '05615|999')).toBeNull();
  });

  it('apariciones: upsert por (fuente, id externo)', async () => {
    const b = await crearBusquedaDePrueba();
    const l = await repo.createLead(nuevoLead());
    await repo.upsertAparicion({ leadId: l.id, fuente: 'osm', idExterno: 'node/1', coincidencia: 'nuevo', datos: { v: 1 }, busquedaId: b });
    await repo.upsertAparicion({ leadId: l.id, fuente: 'osm', idExterno: 'node/1', coincidencia: 'nuevo', datos: { v: 2 }, busquedaId: b });
    expect((await repo.findLeadByAparicion('osm', 'node/1'))?.id).toBe(l.id);
    const detalle = await repo.findLeadDetalle(l.id);
    expect(detalle?.apariciones).toHaveLength(1);
    expect(detalle?.apariciones[0].datos).toEqual({ v: 2 });
  });

  it('búsquedas espaciales, por placa y por palabra', async () => {
    const a = await repo.createLead(nuevoLead());
    await repo.createLead(nuevoLead({ nombre: 'Lejos', nombresNorm: 'lejos', lat: 6.3, lon: -75.6, direccionNorm: null }));
    await repo.createLead(nuevoLead({ codMpio: '05001', nombresNorm: 'hotel prueba' }));
    expect((await repo.findLeadsCercanos('05615', 6.1515, -75.3736, 0.003)).map((l) => l.id)).toEqual([a.id]);
    expect((await repo.findLeadsPorDireccion('05615', 'kr 50 46 23')).map((l) => l.id)).toEqual([a.id]);
    expect((await repo.findLeadsPorPalabra('05615', 'prueba')).map((l) => l.id)).toEqual([a.id]);
  });

  it('listado con filtros, conteos y estadísticas', async () => {
    const b = await crearBusquedaDePrueba();
    const a = await repo.createLead(nuevoLead({ fuentes: ['dane', 'osm'], numFuentes: 2, nit: '900000001' }));
    const c = await repo.createLead(nuevoLead({ nombre: 'Sin contacto', nombresNorm: 'sin contacto', contactable: false, canalPrincipal: null, telefonos: [], esPersonaNatural: true }));
    await repo.createBusquedaLead(b, a.id, 'dane', 'nuevo');
    await repo.createBusquedaLead(b, a.id, 'osm', 'enriquecido');
    await repo.createBusquedaLead(b, c.id, 'osm', 'nuevo');
    await repo.upsertAparicion({ leadId: a.id, fuente: 'dane', idExterno: '900000001', coincidencia: 'nuevo', datos: null, busquedaId: b });

    expect(await repo.countLeads({ busquedaId: b })).toBe(2);
    expect(await repo.countLeads({ busquedaId: b, contactable: true })).toBe(1);
    expect(await repo.countLeads({ enAmbas: true })).toBe(1);
    expect(await repo.countLeads({ fuente: 'dane' })).toBe(1);
    expect(await repo.countLeads({ personasNaturales: false })).toBe(1);
    expect(await repo.countLeads({ q: '900000001' })).toBe(1);
    expect(await repo.countLeads({ codDpto: '05' })).toBe(2);
    expect(await repo.countLeadsNuevosDeBusqueda(b)).toBe(2);
    const pagina = await repo.findLeads({ limite: 1, pagina: 1 });
    expect(pagina.map((l) => l.id)).toEqual([a.id]);
    expect(await repo.findEstadisticasPorFuente()).toEqual([{ fuente: 'dane', leads: 1, contactables: 1, atribuidos: 0 }]);
  });

  it('asignarContacto: solo el primero se queda con el lead y el listado trae quién lo contactó', async () => {
    const andres = await crearUsuarioDePrueba();
    const camila = await crearUsuarioDePrueba({ email: 'camila@gmail.com', fullName: 'Camila Rojas' });
    const a = await repo.createLead(nuevoLead());
    const b = await repo.createLead(nuevoLead({ nombre: 'Otro', nombresNorm: 'otro' }));

    // Dos personas le dan "Contactar" al mismo tiempo: solo una gana.
    const [r1, r2] = await Promise.all([repo.asignarContacto(a.id, andres), repo.asignarContacto(a.id, camila)]);
    expect([r1, r2].filter(Boolean)).toHaveLength(1);
    expect(await repo.asignarContacto(b.id, camila)).toBe(true);

    const detalle = await repo.findLead(a.id);
    expect(detalle).toMatchObject({ contactado: true, contactadoPor: { id: detalle!.contactadoPorId, email: expect.any(String) } });
    expect(detalle!.contactadoEn).toBeTruthy();

    expect(await repo.countLeads({ contactado: true })).toBe(2);
    expect(await repo.countLeads({ contactado: true, contactadoPorId: camila })).toBe(r2 ? 2 : 1);
    const lista = await repo.findLeads({ contactado: true, limite: 10, pagina: 1 });
    expect(lista.every((l) => l.contactadoPor && !('passwordHash' in l.contactadoPor))).toBe(true);

    // Enriquecer el lead desde una búsqueda no toca el contacto.
    await repo.updateLead(b.id, { emails: ['hola@otro.co'], contactado: false, contactadoPorId: null });
    expect(await repo.findLead(b.id)).toMatchObject({ emails: ['hola@otro.co'], contactado: true, contactadoPorId: camila });
  });
});
