// Las consultas de métricas contra PostgreSQL real, con un escenario armado a mano.
import * as repo from 'modules/metricas/repository/metricas.repository';
import * as costosRepo from 'modules/costos/repository/costos.repository';
import * as calificacionesRepo from 'modules/calificaciones/repository/calificaciones.repository';
import * as contactosRepo from 'modules/contactos/repository/contactos.repository';
import type { CreateInteraccionDTO } from 'modules/contactos/types/contactos.types';
import { crearUsuarioDePrueba, describeConBase, limpiarBase, prisma } from '../../../setup/db';

const INICIO = new Date('2026-10-01T05:00:00Z');
const FIN = new Date('2026-11-01T05:00:00Z');
const EN_OCT = new Date('2026-10-14T15:00:00Z');

async function lead(nombre: string, fuente: string, p: Record<string, unknown> = {}) {
  const l = await prisma.lead.create({
    data: { nombre, codMpio: '05615', municipio: 'RIONEGRO', departamento: 'Antioquia', fuenteOrigen: fuente, contactable: true, createdAt: EN_OCT, ...p },
  });
  return l.id;
}

const salida = (leadId: number, usuarioId: number, canal: CreateInteraccionDTO['canal'], estado: CreateInteraccionDTO['estado'] = 'ENVIADO'): CreateInteraccionDTO => ({
  leadId, usuarioId, canal, sentido: 'SALIENTE', estado, destino: null, asunto: null, mensaje: null, nota: null, resultado: null,
  error: null, proveedorId: null, plantillaId: null,
});

describeConBase('metricas.repository', () => {
  beforeEach(limpiarBase);
  afterAll(() => prisma.$disconnect());

  it('cuenta embudo, calidad y contactos por fuente y por canal dentro del periodo', async () => {
    const u = await crearUsuarioDePrueba();
    const a = await lead('A', 'osm', { calidad: 'ALTA', puntaje: 90 });
    const b = await lead('B', 'osm', { calidad: 'BAJA' }); // índice 30 (sin puntaje)
    const c = await lead('C', 'rnt');
    await lead('Viejo', 'rnt', { createdAt: new Date('2026-09-20T15:00:00Z') }); // fuera del periodo
    await lead('D', 'dane', { contactable: false });

    // a: correo + otro correo + respuesta interesada por correo; b: WhatsApp + correo fallido; c: Dapta
    await contactosRepo.guardarSalida(salida(a, u, 'EMAIL'), EN_OCT);
    await contactosRepo.guardarSalida(salida(a, u, 'EMAIL'), EN_OCT);
    await contactosRepo.guardarRespuesta({ ...salida(a, u, 'EMAIL', 'REGISTRADO'), sentido: 'ENTRANTE', resultado: 'INTERESADO' }, 'INTERESADO', EN_OCT);
    await contactosRepo.guardarSalida(salida(b, u, 'WHATSAPP', 'REGISTRADO'), EN_OCT);
    await contactosRepo.createInteraccion(salida(b, u, 'EMAIL', 'FALLIDO'));
    await calificacionesRepo.createCalificacion({
      leadId: c, usuarioId: u, origen: 'DAPTA', estado: 'ENVIADO', referencia: 'r1', calidad: null, puntaje: null, resumen: null,
      variables: null, llamadaId: null, error: null, calificadoEn: null,
    });
    await calificacionesRepo.createCalificacion({
      leadId: b, usuarioId: u, origen: 'DAPTA', estado: 'FALLIDO', referencia: 'r2', calidad: null, puntaje: null, resumen: null,
      variables: null, llamadaId: null, error: 'x', calificadoEn: null,
    });
    // created_at de las interacciones y calificaciones = ahora; el periodo debe incluir hoy.
    const fin = new Date(Date.now() + 86_400_000);

    const fuentes = await repo.findDatosPorFuente(INICIO, FIN);
    expect(fuentes.sort((x, y) => x.fuente.localeCompare(y.fuente))).toEqual([
      { fuente: 'dane', leads: 1, contactables: 0, contactados: 0, respondieron: 0, interesados: 0, calificados: 0, alta: 0, indiceSuma: 0 },
      { fuente: 'osm', leads: 2, contactables: 2, contactados: 2, respondieron: 1, interesados: 1, calificados: 2, alta: 1, indiceSuma: 120 },
      { fuente: 'rnt', leads: 1, contactables: 1, contactados: 0, respondieron: 0, interesados: 0, calificados: 0, alta: 0, indiceSuma: 0 },
    ]);

    const canales = await repo.findDatosPorCanal(INICIO, fin);
    expect(canales.sort((x, y) => x.canal.localeCompare(y.canal))).toEqual([
      { canal: 'dapta', contactos: 1, contactados: 1, respondieron: 0, interesados: 0, calificados: 0, alta: 0, indiceSuma: 0 },
      { canal: 'email', contactos: 2, contactados: 1, respondieron: 1, interesados: 1, calificados: 1, alta: 1, indiceSuma: 90 },
      { canal: 'whatsapp', contactos: 1, contactados: 1, respondieron: 0, interesados: 0, calificados: 1, alta: 0, indiceSuma: 30 },
    ]);

    const porFuente = await repo.findContactosPorFuente(INICIO, fin);
    expect(porFuente.sort((x, y) => (x.canal + x.fuente).localeCompare(y.canal + y.fuente))).toEqual([
      { canal: 'dapta', fuente: 'rnt', leads: 1 },
      { canal: 'email', fuente: 'osm', leads: 1 },
      { canal: 'whatsapp', fuente: 'osm', leads: 1 },
    ]);

    // Fuera del rango: nada.
    expect(await repo.findDatosPorCanal(new Date('2025-01-01'), new Date('2025-02-01'))).toEqual([]);
  });

  it('costos: guarda decimales y fechas, y filtra los que se cruzan con el periodo', async () => {
    const u = await crearUsuarioDePrueba();
    await costosRepo.createCosto({ canal: 'general', tipo: 'GASTO', descripcion: 'Servidor', monto: 93000.5, horas: null, valorHora: null, desde: '2026-10-01', hasta: '2026-10-31', creadoPorId: u });
    await costosRepo.createCosto({ canal: 'rnt', tipo: 'HORAS', descripcion: 'Revisión', monto: 62000, horas: 2, valorHora: 31000, desde: '2026-09-25', hasta: '2026-10-02', creadoPorId: u });
    await costosRepo.createCosto({ canal: 'email', tipo: 'GASTO', descripcion: 'Agosto', monto: 1, horas: null, valorHora: null, desde: '2026-08-01', hasta: '2026-08-31' });
    const oct = await costosRepo.findCostos({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(oct.map((c) => [c.canal, c.monto, c.horas, c.valorHora, c.desde, c.hasta])).toEqual([
      ['general', 93000.5, null, null, '2026-10-01', '2026-10-31'],
      ['rnt', 62000, 2, 31000, '2026-09-25', '2026-10-02'],
    ]);
    expect(oct[0].creadoPor).toEqual({ id: u, fullName: 'Andres Saray' });
    expect(await costosRepo.findCostos()).toHaveLength(3);
    const actualizado = await costosRepo.updateCosto(oct[0].id, { hasta: '2026-11-30' });
    expect(actualizado.hasta).toBe('2026-11-30');
    await costosRepo.deleteCosto(oct[0].id);
    expect(await costosRepo.findCosto(oct[0].id)).toBeNull();
  });

  it('calificaciones: el resultado se copia al lead; la manual también', async () => {
    const u = await crearUsuarioDePrueba();
    const id = await lead('A', 'osm');
    const c = await calificacionesRepo.createCalificacion({
      leadId: id, usuarioId: u, origen: 'DAPTA', estado: 'ENVIADO', referencia: 'ref-a', calidad: null, puntaje: null, resumen: null,
      variables: null, llamadaId: null, error: null, calificadoEn: null,
    });
    expect((await calificacionesRepo.findEnvioPendiente(id))?.id).toBe(c.id);
    expect(await calificacionesRepo.findEnvioPendiente(id, new Date(Date.now() + 60_000))).toBeNull();
    const t = new Date('2026-10-14T16:00:00Z');
    await calificacionesRepo.guardarResultado(c.id, { estado: 'CALIFICADO', calidad: 'MEDIA', puntaje: 60, resumen: 'ok', variables: { demo: false }, llamadaId: 'call-1', error: null, calificadoEn: t });
    expect(await prisma.lead.findUnique({ where: { id }, select: { calidad: true, puntaje: true, calificadoEn: true } })).toEqual({ calidad: 'MEDIA', puntaje: 60, calificadoEn: t });
    expect((await calificacionesRepo.findCalificacionPorReferencia('ref-a'))?.variables).toEqual({ demo: false });
    expect(await calificacionesRepo.findEnvioPendiente(id)).toBeNull();

    await calificacionesRepo.crearCalificacionManual({
      leadId: id, usuarioId: u, origen: 'MANUAL', estado: 'CALIFICADO', referencia: 'ref-m', calidad: 'ALTA', puntaje: null, resumen: 'Visita',
      variables: null, llamadaId: null, error: null, calificadoEn: t,
    });
    expect((await prisma.lead.findUnique({ where: { id } }))?.calidad).toBe('ALTA');
    expect((await calificacionesRepo.findCalificaciones(id)).map((x) => x.origen)).toEqual(['MANUAL', 'DAPTA']);
    expect((await calificacionesRepo.findLeadParaDapta(id))?.fuenteOrigen).toBe('osm');
  });
});
