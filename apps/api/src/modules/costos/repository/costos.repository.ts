// Acceso a datos de costos. Las fechas viajan como "AAAA-MM-DD" (columnas DATE).
import { prisma, type Prisma } from '~config/db/client';
import type { CanalCosto, CostoDTO, DatosCostoDTO } from '../types/costos.types';

const CON_AUTOR = { creadoPor: { select: { id: true, fullName: true } } } as const;
type Fila = Prisma.CostoGetPayload<{ include: typeof CON_AUTOR }>;

const aFecha = (s: string) => new Date(`${s}T00:00:00Z`);
const deFecha = (d: Date) => d.toISOString().slice(0, 10);
const num = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));

function aDTO({ updatedAt: _u, ...f }: Fila): CostoDTO {
  return {
    ...f,
    canal: f.canal as CanalCosto,
    monto: Number(f.monto),
    horas: num(f.horas),
    valorHora: num(f.valorHora),
    desde: deFecha(f.desde),
    hasta: deFecha(f.hasta),
  };
}

function aData(d: Partial<DatosCostoDTO>) {
  return {
    ...d,
    ...(d.desde !== undefined ? { desde: aFecha(d.desde) } : {}),
    ...(d.hasta !== undefined ? { hasta: aFecha(d.hasta) } : {}),
  };
}

/** Costos cuyo periodo se cruza con [desde, hasta]. Sin fechas: todos. */
export async function findCostos(f: { desde?: string; hasta?: string } = {}): Promise<CostoDTO[]> {
  const filas = await prisma.costo.findMany({
    where: {
      ...(f.hasta ? { desde: { lte: aFecha(f.hasta) } } : {}),
      ...(f.desde ? { hasta: { gte: aFecha(f.desde) } } : {}),
    },
    include: CON_AUTOR,
    orderBy: [{ desde: 'desc' }, { id: 'desc' }],
  });
  return filas.map(aDTO);
}

export async function findCosto(id: number): Promise<CostoDTO | null> {
  const f = await prisma.costo.findUnique({ where: { id }, include: CON_AUTOR });
  return f ? aDTO(f) : null;
}

export async function createCosto(d: DatosCostoDTO): Promise<CostoDTO> {
  return aDTO(await prisma.costo.create({ data: aData(d) as Prisma.CostoUncheckedCreateInput, include: CON_AUTOR }));
}

export async function updateCosto(id: number, d: Partial<DatosCostoDTO>): Promise<CostoDTO> {
  return aDTO(await prisma.costo.update({ where: { id }, data: aData(d) as Prisma.CostoUncheckedUpdateInput, include: CON_AUTOR }));
}

export async function deleteCosto(id: number): Promise<void> {
  await prisma.costo.delete({ where: { id } });
}
