// Acceso a datos del contacto con leads: historial de interacciones y estado del embudo.
// Las funciones que tocan dos tablas lo hacen en una transacción.
import { prisma, type Prisma } from '~config/db/client';
import type { Telefono } from '~types/fuente.types';
import type {
  CreateInteraccionDTO,
  EstadoContacto,
  InteraccionDTO,
  LeadContactoDTO,
  ResultadoRespuesta,
  SalidaPreviaDTO,
} from '../types/contactos.types';

const CAMPOS_LEAD = {
  id: true, nombre: true, municipio: true, departamento: true, categorias: true, telefonos: true, emails: true,
  contactado: true, contactadoEn: true, contactadoPorId: true, estadoContacto: true, ultimoContactoEn: true,
  respondioEn: true, noContactar: true, noContactarEn: true, calidad: true, puntaje: true, calificadoEn: true,
  contactadoPor: { select: { id: true, fullName: true, email: true } },
} as const satisfies Prisma.LeadSelect;

type FilaLead = Prisma.LeadGetPayload<{ select: typeof CAMPOS_LEAD }>;

const aLead = (f: FilaLead): LeadContactoDTO => ({
  ...f,
  telefonos: (f.telefonos as unknown as Telefono[]) ?? [],
  categorias: f.categorias ?? [],
  emails: f.emails ?? [],
});

type FilaInteraccion = Prisma.InteraccionGetPayload<{ include: { usuario: { select: { id: true; fullName: true } } } }>;
const aInteraccion = ({ updatedAt: _u, ...f }: FilaInteraccion): InteraccionDTO => f;

export async function findLeadContacto(id: number): Promise<LeadContactoDTO | null> {
  const f = await prisma.lead.findUnique({ where: { id }, select: CAMPOS_LEAD });
  return f ? aLead(f) : null;
}

export async function findInteracciones(leadId: number): Promise<InteraccionDTO[]> {
  const filas = await prisma.interaccion.findMany({
    where: { leadId },
    include: { usuario: { select: { id: true, fullName: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return filas.map(aInteraccion);
}

/** Mensajes o llamadas que salieron (sin contar los fallidos) desde una fecha. */
export async function findSalidasDesde(leadId: number, desde: Date): Promise<SalidaPreviaDTO[]> {
  return prisma.interaccion.findMany({
    where: { leadId, sentido: 'SALIENTE', estado: { not: 'FALLIDO' }, createdAt: { gte: desde } },
    select: { canal: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

/** Guarda un intento fallido (no cambia el estado del lead). */
export async function createInteraccion(dto: CreateInteraccionDTO): Promise<InteraccionDTO> {
  const f = await prisma.interaccion.create({ data: dto, include: { usuario: { select: { id: true, fullName: true } } } });
  return aInteraccion(f);
}

/**
 * Guarda un mensaje o llamada que salió y actualiza el lead: si nadie lo tenía queda asignado
 * a quien lo contactó, y si estaba PENDIENTE pasa a CONTACTADO.
 */
export async function guardarSalida(dto: CreateInteraccionDTO, ahora: Date): Promise<InteraccionDTO> {
  return prisma.$transaction(async (tx) => {
    const f = await tx.interaccion.create({ data: dto, include: { usuario: { select: { id: true, fullName: true } } } });
    if (dto.usuarioId) {
      await tx.lead.updateMany({
        where: { id: dto.leadId, contactado: false },
        data: { contactado: true, contactadoEn: ahora, contactadoPorId: dto.usuarioId },
      });
    }
    await tx.lead.updateMany({ where: { id: dto.leadId, estadoContacto: 'PENDIENTE' }, data: { estadoContacto: 'CONTACTADO' } });
    await tx.lead.update({ where: { id: dto.leadId }, data: { ultimoContactoEn: ahora } });
    return aInteraccion(f);
  });
}

/** Guarda la respuesta del lead y deja su estado en el resultado. respondioEn = la primera respuesta. */
export async function guardarRespuesta(dto: CreateInteraccionDTO, resultado: ResultadoRespuesta, ahora: Date): Promise<InteraccionDTO> {
  return prisma.$transaction(async (tx) => {
    const f = await tx.interaccion.create({ data: dto, include: { usuario: { select: { id: true, fullName: true } } } });
    await tx.lead.update({ where: { id: dto.leadId }, data: { estadoContacto: resultado satisfies EstadoContacto } });
    if (resultado !== 'REBOTADO') {
      await tx.lead.updateMany({ where: { id: dto.leadId, respondioEn: null }, data: { respondioEn: ahora } });
    }
    return aInteraccion(f);
  });
}

/** Marca que el lead no quiere más mensajes (y deja constancia en el historial). true si cambió. */
export async function marcarNoContactar(dto: CreateInteraccionDTO, ahora: Date): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const r = await tx.lead.updateMany({ where: { id: dto.leadId, noContactar: false }, data: { noContactar: true, noContactarEn: ahora } });
    if (r.count === 1) await tx.interaccion.create({ data: dto });
    return r.count === 1;
  });
}
