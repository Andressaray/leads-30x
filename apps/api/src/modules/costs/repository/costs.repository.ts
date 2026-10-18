// Cost data access. Dates travel as "YYYY-MM-DD" (DATE columns).
import { prisma, type Prisma } from '~config/db/client';
import type { CostChannel, CostDTO, CostDataDTO } from '../types/costs.types';

const WITH_AUTHOR = { createdBy: { select: { id: true, fullName: true } } } as const;
type Row = Prisma.CostGetPayload<{ include: typeof WITH_AUTHOR }>;

const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const fromDate = (d: Date) => d.toISOString().slice(0, 10);
const num = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));

function toDTO({ updatedAt: _u, ...f }: Row): CostDTO {
  return {
    ...f,
    channel: f.channel as CostChannel,
    amount: Number(f.amount),
    hours: num(f.hours),
    hourlyRate: num(f.hourlyRate),
    from: fromDate(f.from),
    to: fromDate(f.to),
  };
}

function toData(d: Partial<CostDataDTO>) {
  return {
    ...d,
    ...(d.from !== undefined ? { from: toDate(d.from) } : {}),
    ...(d.to !== undefined ? { to: toDate(d.to) } : {}),
  };
}

/** Costs whose period overlaps [from, to]. Without dates: all of them. */
export async function findCosts(f: { from?: string; to?: string } = {}): Promise<CostDTO[]> {
  const rows = await prisma.cost.findMany({
    where: {
      ...(f.to ? { from: { lte: toDate(f.to) } } : {}),
      ...(f.from ? { to: { gte: toDate(f.from) } } : {}),
    },
    include: WITH_AUTHOR,
    orderBy: [{ from: 'desc' }, { id: 'desc' }],
  });
  return rows.map(toDTO);
}

export async function findCost(id: number): Promise<CostDTO | null> {
  const f = await prisma.cost.findUnique({ where: { id }, include: WITH_AUTHOR });
  return f ? toDTO(f) : null;
}

export async function createCost(d: CostDataDTO): Promise<CostDTO> {
  return toDTO(await prisma.cost.create({ data: toData(d) as Prisma.CostUncheckedCreateInput, include: WITH_AUTHOR }));
}

export async function updateCost(id: number, d: Partial<CostDataDTO>): Promise<CostDTO> {
  return toDTO(await prisma.cost.update({ where: { id }, data: toData(d) as Prisma.CostUncheckedUpdateInput, include: WITH_AUTHOR }));
}

export async function deleteCost(id: number): Promise<void> {
  await prisma.cost.delete({ where: { id } });
}
