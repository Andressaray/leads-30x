// Acceso a datos de calificaciones (envíos a Dapta y calificaciones manuales).
import { prisma, type Prisma } from '~config/db/client';
import type { Telefono } from '~types/fuente.types';
import type {
  CalificacionDTO,
  CreateCalificacionDTO,
  LeadParaDaptaDTO,
  ResultadoCalificacionDTO,
} from '../types/calificaciones.types';

const CON_USUARIO = { usuario: { select: { id: true, fullName: true } } } as const;
type Fila = Prisma.CalificacionGetPayload<{ include: typeof CON_USUARIO }>;
const aDTO = ({ updatedAt: _u, ...f }: Fila): CalificacionDTO => f;

const json = (v: unknown) => (v === undefined || v === null ? undefined : (v as Prisma.InputJsonValue));

export async function findLeadParaDapta(id: number): Promise<LeadParaDaptaDTO | null> {
  const f = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true, nombre: true, municipio: true, departamento: true, categorias: true, telefonos: true, emails: true,
      fuenteOrigen: true, estadoContacto: true, noContactar: true, contactadoPorId: true,
      contactadoPor: { select: { id: true, fullName: true } },
    },
  });
  return f ? { ...f, telefonos: (f.telefonos as unknown as Telefono[]) ?? [] } : null;
}

export async function findCalificaciones(leadId: number): Promise<CalificacionDTO[]> {
  const filas = await prisma.calificacion.findMany({ where: { leadId }, include: CON_USUARIO, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  return filas.map(aDTO);
}

export async function findCalificacionPorReferencia(referencia: string): Promise<CalificacionDTO | null> {
  const f = await prisma.calificacion.findUnique({ where: { referencia }, include: CON_USUARIO });
  return f ? aDTO(f) : null;
}

/** Último envío a Dapta de un lead que sigue esperando resultado (opcionalmente, solo los posteriores a una fecha). */
export async function findEnvioPendiente(leadId: number, desde?: Date): Promise<CalificacionDTO | null> {
  const f = await prisma.calificacion.findFirst({
    where: { leadId, origen: 'DAPTA', estado: { in: ['ENVIADO', 'SIMULADO'] }, ...(desde ? { createdAt: { gte: desde } } : {}) },
    include: CON_USUARIO,
    orderBy: { createdAt: 'desc' },
  });
  return f ? aDTO(f) : null;
}

export async function createCalificacion(dto: CreateCalificacionDTO): Promise<CalificacionDTO> {
  const { variables, ...resto } = dto;
  return aDTO(await prisma.calificacion.create({ data: { ...resto, variables: json(variables) }, include: CON_USUARIO }));
}

/**
 * Guarda el resultado de una calificación y, si trae calidad, la copia al lead
 * (el lead siempre muestra la calificación más reciente).
 */
export async function guardarResultado(id: number, r: ResultadoCalificacionDTO): Promise<CalificacionDTO> {
  return prisma.$transaction(async (tx) => {
    const { variables, ...resto } = r;
    const f = await tx.calificacion.update({ where: { id }, data: { ...resto, variables: json(variables) }, include: CON_USUARIO });
    if (r.estado === 'CALIFICADO' && r.calidad) {
      await tx.lead.update({ where: { id: f.leadId }, data: { calidad: r.calidad, puntaje: r.puntaje, calificadoEn: r.calificadoEn } });
    }
    return aDTO(f);
  });
}

/** Calificación manual: se crea ya calificada y se copia al lead. */
export async function crearCalificacionManual(dto: CreateCalificacionDTO): Promise<CalificacionDTO> {
  return prisma.$transaction(async (tx) => {
    const { variables, ...resto } = dto;
    const f = await tx.calificacion.create({ data: { ...resto, variables: json(variables) }, include: CON_USUARIO });
    await tx.lead.update({ where: { id: dto.leadId }, data: { calidad: dto.calidad, puntaje: dto.puntaje, calificadoEn: dto.calificadoEn } });
    return aDTO(f);
  });
}
