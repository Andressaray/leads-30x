// Template data access. One function per query, no business rules.
import { prisma } from '~config/db/client';
import type { CreateTemplateDTO, TemplateFiltersDTO, TemplateDTO, UpdateTemplateDTO } from '../types/templates.types';

const WITH_AUTHOR = { createdBy: { select: { id: true, fullName: true } } } as const;

type Row = Omit<TemplateDTO, 'channel'> & { channel: string };
const toDTO = (f: Row): TemplateDTO => ({ ...f, channel: f.channel as TemplateDTO['channel'] });

export async function findTemplates(f: TemplateFiltersDTO): Promise<TemplateDTO[]> {
  const rows = await prisma.template.findMany({
    where: { ...(f.channel ? { channel: f.channel } : {}), ...(f.includeInactive ? {} : { active: true }) },
    include: WITH_AUTHOR,
    orderBy: [{ active: 'desc' }, { channel: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toDTO);
}

export async function findTemplate(id: number): Promise<TemplateDTO | null> {
  const row = await prisma.template.findUnique({ where: { id }, include: WITH_AUTHOR });
  return row ? toDTO(row) : null;
}

export async function findTemplateByName(name: string): Promise<TemplateDTO | null> {
  const row = await prisma.template.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
  return row ? toDTO(row) : null;
}

export async function createTemplate(dto: CreateTemplateDTO): Promise<TemplateDTO> {
  return toDTO(await prisma.template.create({ data: dto, include: WITH_AUTHOR }));
}

export async function updateTemplate(id: number, dto: UpdateTemplateDTO): Promise<TemplateDTO> {
  return toDTO(await prisma.template.update({ where: { id }, data: dto, include: WITH_AUTHOR }));
}
