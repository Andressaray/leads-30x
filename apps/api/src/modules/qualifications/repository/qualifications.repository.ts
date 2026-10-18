// Qualification data access (dispatches to Dapta and manual qualifications).
import { prisma, type Prisma } from '~config/db/client';
import type { Phone } from '~types/source.types';
import type {
  QualificationDTO,
  CreateQualificationDTO,
  LeadForDaptaDTO,
  QualificationResultDTO,
} from '../types/qualifications.types';

const WITH_USER = { user: { select: { id: true, fullName: true } } } as const;
type Row = Prisma.QualificationGetPayload<{ include: typeof WITH_USER }>;
const toDTO = ({ updatedAt: _u, ...f }: Row): QualificationDTO => f;

const json = (v: unknown) => (v === undefined || v === null ? undefined : (v as Prisma.InputJsonValue));

export async function findLeadForDapta(id: number): Promise<LeadForDaptaDTO | null> {
  const f = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true, name: true, municipality: true, department: true, categories: true, phones: true, emails: true,
      originSource: true, contactStatus: true, doNotContact: true, contactedById: true,
      contactedBy: { select: { id: true, fullName: true } },
    },
  });
  return f ? { ...f, phones: (f.phones as unknown as Phone[]) ?? [] } : null;
}

export async function findQualifications(leadId: number): Promise<QualificationDTO[]> {
  const rows = await prisma.qualification.findMany({ where: { leadId }, include: WITH_USER, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  return rows.map(toDTO);
}

export async function findQualificationByReference(reference: string): Promise<QualificationDTO | null> {
  const f = await prisma.qualification.findUnique({ where: { reference }, include: WITH_USER });
  return f ? toDTO(f) : null;
}

/** Latest dispatch to Dapta of a lead that is still waiting for a result (optionally, only the ones after a date). */
export async function findPendingDispatch(leadId: number, from?: Date): Promise<QualificationDTO | null> {
  const f = await prisma.qualification.findFirst({
    where: { leadId, origin: 'DAPTA', status: { in: ['SENT', 'SIMULATED'] }, ...(from ? { createdAt: { gte: from } } : {}) },
    include: WITH_USER,
    orderBy: { createdAt: 'desc' },
  });
  return f ? toDTO(f) : null;
}

export async function createQualification(dto: CreateQualificationDTO): Promise<QualificationDTO> {
  const { variables, ...rest } = dto;
  return toDTO(await prisma.qualification.create({ data: { ...rest, variables: json(variables) }, include: WITH_USER }));
}

/**
 * Stores the result of a qualification and, if it comes with a quality, copies it to the lead
 * (the lead always shows the most recent qualification).
 */
export async function saveResult(id: number, r: QualificationResultDTO): Promise<QualificationDTO> {
  return prisma.$transaction(async (tx) => {
    const { variables, ...rest } = r;
    const f = await tx.qualification.update({ where: { id }, data: { ...rest, variables: json(variables) }, include: WITH_USER });
    if (r.status === 'QUALIFIED' && r.quality) {
      await tx.lead.update({ where: { id: f.leadId }, data: { quality: r.quality, score: r.score, qualifiedAt: r.qualifiedAt } });
    }
    return toDTO(f);
  });
}

/** Manual qualification: it is created already qualified and copied to the lead. */
export async function createManualQualification(dto: CreateQualificationDTO): Promise<QualificationDTO> {
  return prisma.$transaction(async (tx) => {
    const { variables, ...rest } = dto;
    const f = await tx.qualification.create({ data: { ...rest, variables: json(variables) }, include: WITH_USER });
    await tx.lead.update({ where: { id: dto.leadId }, data: { quality: dto.quality, score: dto.score, qualifiedAt: dto.qualifiedAt } });
    return toDTO(f);
  });
}
