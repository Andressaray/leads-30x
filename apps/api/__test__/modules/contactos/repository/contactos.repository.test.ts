// Contra la base de pruebas real (DATABASE_URL_TEST): transacciones y cambios de estado del lead.
import * as repo from 'modules/contactos/repository/contactos.repository';
import * as leadsRepo from 'modules/leads/repository/leads.repository';
import * as plantillasRepo from 'modules/plantillas/repository/plantillas.repository';
import type { CreateInteraccionDTO } from 'modules/contactos/types/contactos.types';
import { crearUsuarioDePrueba, describeConBase, limpiarBase, prisma } from '../../../setup/db';

async function crearLead(): Promise<number> {
  const l = await prisma.lead.create({
    data: {
      nombre: 'Café Prueba', codMpio: '05615', municipio: 'RIONEGRO', departamento: 'Antioquia', fuenteOrigen: 'osm',
      emails: ['hola@cafe.test'], telefonos: [{ numero: '+573001112233', tipo: 'movil', whatsapp: true }],
    },
  });
  return l.id;
}

const salida = (leadId: number, usuarioId: number | null, p: Partial<CreateInteraccionDTO> = {}): CreateInteraccionDTO => ({
  leadId, usuarioId, canal: 'EMAIL', sentido: 'SALIENTE', estado: 'ENVIADO', destino: 'hola@cafe.test', asunto: 'Hola',
  mensaje: 'Mensaje', nota: null, resultado: null, error: null, proveedorId: '<x@y>', plantillaId: null, ...p,
});

describeConBase('contactos.repository', () => {
  beforeEach(limpiarBase);
  afterAll(() => prisma.$disconnect());

  it('guardarSalida: asigna, pasa a CONTACTADO y no le quita el lead a quien lo tenía', async () => {
    const andres = await crearUsuarioDePrueba();
    const camila = await crearUsuarioDePrueba({ email: 'camila@gmail.com', fullName: 'Camila Rojas' });
    const id = await crearLead();
    const t1 = new Date('2026-10-14T15:00:00Z');
    const i = await repo.guardarSalida(salida(id, andres), t1);
    expect(i).toMatchObject({ canal: 'EMAIL', estado: 'ENVIADO', usuario: { id: andres, fullName: 'Andres Saray' } });
    expect(await repo.findLeadContacto(id)).toMatchObject({
      contactado: true, contactadoPorId: andres, estadoContacto: 'CONTACTADO', ultimoContactoEn: t1,
      contactadoPor: { fullName: 'Andres Saray' },
    });
    const t2 = new Date('2026-10-15T15:00:00Z');
    await repo.guardarSalida(salida(id, camila, { canal: 'LLAMADA', estado: 'REGISTRADO' }), t2);
    expect(await repo.findLeadContacto(id)).toMatchObject({ contactadoPorId: andres, ultimoContactoEn: t2 });
  });

  it('guardarRespuesta: estado = resultado y respondioEn solo la primera vez (el rebote no cuenta)', async () => {
    const u = await crearUsuarioDePrueba();
    const id = await crearLead();
    await repo.guardarSalida(salida(id, u), new Date('2026-10-14T15:00:00Z'));
    const entrante = (resultado: 'REBOTADO' | 'RESPONDIO' | 'INTERESADO') =>
      salida(id, u, { sentido: 'ENTRANTE', estado: 'REGISTRADO', resultado, destino: null, proveedorId: null });
    await repo.guardarRespuesta(entrante('REBOTADO'), 'REBOTADO', new Date('2026-10-14T16:00:00Z'));
    expect(await repo.findLeadContacto(id)).toMatchObject({ estadoContacto: 'REBOTADO', respondioEn: null });
    await repo.guardarRespuesta(entrante('RESPONDIO'), 'RESPONDIO', new Date('2026-10-14T17:00:00Z'));
    await repo.guardarRespuesta(entrante('INTERESADO'), 'INTERESADO', new Date('2026-10-14T18:00:00Z'));
    expect(await repo.findLeadContacto(id)).toMatchObject({ estadoContacto: 'INTERESADO', respondioEn: new Date('2026-10-14T17:00:00Z') });
    expect((await repo.findInteracciones(id)).map((i) => i.resultado)).toEqual(['INTERESADO', 'RESPONDIO', 'REBOTADO', null]);
  });

  it('findSalidasDesde ignora fallidas, entrantes y anteriores', async () => {
    const u = await crearUsuarioDePrueba();
    const id = await crearLead();
    await repo.createInteraccion(salida(id, u, { estado: 'FALLIDO', error: '550' }));
    await repo.guardarSalida(salida(id, u, { canal: 'WHATSAPP', estado: 'REGISTRADO' }), new Date());
    await repo.guardarRespuesta(salida(id, u, { sentido: 'ENTRANTE', estado: 'REGISTRADO', resultado: 'RESPONDIO' }), 'RESPONDIO', new Date());
    const salidas = await repo.findSalidasDesde(id, new Date(Date.now() - 60_000));
    expect(salidas.map((s) => s.canal)).toEqual(['WHATSAPP']);
    expect(await repo.findSalidasDesde(id, new Date(Date.now() + 60_000))).toEqual([]);
  });

  it('marcarNoContactar es idempotente y sin usuario (enlace de baja)', async () => {
    const id = await crearLead();
    const dto = salida(id, null, { sentido: 'ENTRANTE', estado: 'REGISTRADO', canal: 'EMAIL', nota: 'Baja' });
    expect(await repo.marcarNoContactar(dto, new Date())).toBe(true);
    expect(await repo.marcarNoContactar(dto, new Date())).toBe(false);
    expect((await repo.findLeadContacto(id))?.noContactar).toBe(true);
    expect(await repo.findInteracciones(id)).toHaveLength(1);
  });

  it('el botón "Contactar" (sin mensaje) también deja el lead en CONTACTADO; el filtro por estado funciona', async () => {
    const u = await crearUsuarioDePrueba();
    const id = await crearLead();
    await crearLead();
    expect(await leadsRepo.asignarContacto(id, u)).toBe(true);
    const filtros = { limite: 10, pagina: 1 };
    expect((await leadsRepo.findLeads({ ...filtros, estados: ['CONTACTADO'] })).map((l) => l.id)).toEqual([id]);
    expect(await leadsRepo.countLeads({ estados: ['PENDIENTE', 'CONTACTADO'] })).toBe(2);
  });

  it('una búsqueda que enriquece el lead no pisa su estado de contacto', async () => {
    const u = await crearUsuarioDePrueba();
    const id = await crearLead();
    await repo.guardarRespuesta(salida(id, u, { sentido: 'ENTRANTE', resultado: 'INTERESADO' }), 'INTERESADO', new Date());
    await leadsRepo.updateLead(id, { estadoContacto: 'PENDIENTE', noContactar: false, nit: '900000001' });
    expect(await repo.findLeadContacto(id)).toMatchObject({ estadoContacto: 'INTERESADO' });
  });

  it('plantillas: crea, busca por nombre sin importar mayúsculas y oculta las inactivas', async () => {
    const u = await crearUsuarioDePrueba();
    const p = await plantillasRepo.createPlantilla({ nombre: 'Primer correo', canal: 'EMAIL', asunto: 'Hola', cuerpo: 'Texto', creadoPorId: u });
    await plantillasRepo.createPlantilla({ nombre: 'WA', canal: 'WHATSAPP', asunto: null, cuerpo: 'Texto', creadoPorId: null });
    expect((await plantillasRepo.findPlantillaPorNombre('PRIMER CORREO'))?.id).toBe(p.id);
    expect((await plantillasRepo.findPlantilla(p.id))?.creadoPor).toEqual({ id: u, fullName: 'Andres Saray' });
    await plantillasRepo.updatePlantilla(p.id, { activa: false });
    expect((await plantillasRepo.findPlantillas({})).map((x) => x.nombre)).toEqual(['WA']);
    expect(await plantillasRepo.findPlantillas({ incluirInactivas: true, canal: 'EMAIL' })).toHaveLength(1);
    // Borrar el lead borra su historial; borrar la plantilla deja el historial sin plantilla.
    const id = await crearLead();
    await repo.guardarSalida(salida(id, u, { plantillaId: p.id }), new Date());
    await prisma.plantilla.delete({ where: { id: p.id } });
    expect((await repo.findInteracciones(id))[0].plantillaId).toBeNull();
    await prisma.lead.delete({ where: { id } });
    expect(await prisma.interaccion.count()).toBe(0);
  });
});
