// Outreach data access: interaction history and funnel status.
// Functions that touch two tables do it in a transaction.
import { prisma, type Prisma } from '~config/db/client';
import type { Phone } from '~types/source.types';
import type {
  CreateInteractionDTO,
  ContactStatus,
  InteractionDTO,
  LeadContactDTO,
  ReplyResult,
  PreviousOutboundDTO,
} from '../types/outreach.types';

const LEAD_FIELDS = {
  id: true, name: true, municipality: true, department: true, categories: true, phones: true, emails: true,
  contacted: true, contactedAt: true, contactedById: true, contactStatus: true, lastContactedAt: true,
  repliedAt: true, doNotContact: true, doNotContactAt: true, quality: true, score: true, qualifiedAt: true,
  contactedBy: { select: { id: true, fullName: true, email: true } },
} as const satisfies Prisma.LeadSelect;

type LeadRow = Prisma.LeadGetPayload<{ select: typeof LEAD_FIELDS }>;

const toLead = (f: LeadRow): LeadContactDTO => ({
  ...f,
  phones: (f.phones as unknown as Phone[]) ?? [],
  categories: f.categories ?? [],
  emails: f.emails ?? [],
});

type InteractionRow = Prisma.InteractionGetPayload<{ include: { user: { select: { id: true; fullName: true } } } }>;
const toInteraction = ({ updatedAt: _u, ...f }: InteractionRow): InteractionDTO => f;

export async function findLeadContact(id: number): Promise<LeadContactDTO | null> {
  const f = await prisma.lead.findUnique({ where: { id }, select: LEAD_FIELDS });
  return f ? toLead(f) : null;
}

export async function findInteractions(leadId: number): Promise<InteractionDTO[]> {
  const rows = await prisma.interaction.findMany({
    where: { leadId },
    include: { user: { select: { id: true, fullName: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return rows.map(toInteraction);
}

/** Messages or calls that went out (not counting failed ones) since a date. */
export async function findOutboundSince(leadId: number, from: Date): Promise<PreviousOutboundDTO[]> {
  return prisma.interaction.findMany({
    where: { leadId, direction: 'OUTBOUND', status: { not: 'FAILED' }, createdAt: { gte: from } },
    select: { channel: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

/** Stores a failed attempt (does not change the lead status). */
export async function createInteraction(dto: CreateInteractionDTO): Promise<InteractionDTO> {
  const f = await prisma.interaction.create({ data: dto, include: { user: { select: { id: true, fullName: true } } } });
  return toInteraction(f);
}

/**
 * Stores a message or call that went out and updates the lead: if nobody had it, it is assigned
 * to whoever contacted it, and if it was PENDING it moves to CONTACTED.
 */
export async function saveOutbound(dto: CreateInteractionDTO, now: Date): Promise<InteractionDTO> {
  return prisma.$transaction(async (tx) => {
    const f = await tx.interaction.create({ data: dto, include: { user: { select: { id: true, fullName: true } } } });
    if (dto.userId) {
      await tx.lead.updateMany({
        where: { id: dto.leadId, contacted: false },
        data: { contacted: true, contactedAt: now, contactedById: dto.userId },
      });
    }
    await tx.lead.updateMany({ where: { id: dto.leadId, contactStatus: 'PENDING' }, data: { contactStatus: 'CONTACTED' } });
    await tx.lead.update({ where: { id: dto.leadId }, data: { lastContactedAt: now } });
    return toInteraction(f);
  });
}

/** Stores the lead's reply and sets its status to the result. repliedAt = the first reply. */
export async function saveReply(dto: CreateInteractionDTO, result: ReplyResult, now: Date): Promise<InteractionDTO> {
  return prisma.$transaction(async (tx) => {
    const f = await tx.interaction.create({ data: dto, include: { user: { select: { id: true, fullName: true } } } });
    await tx.lead.update({ where: { id: dto.leadId }, data: { contactStatus: result satisfies ContactStatus } });
    if (result !== 'BOUNCED') {
      await tx.lead.updateMany({ where: { id: dto.leadId, repliedAt: null }, data: { repliedAt: now } });
    }
    return toInteraction(f);
  });
}

/** Marks that the lead does not want more messages (and records it in the history). true if it changed. */
export async function markDoNotContact(dto: CreateInteractionDTO, now: Date): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const r = await tx.lead.updateMany({ where: { id: dto.leadId, doNotContact: false }, data: { doNotContact: true, doNotContactAt: now } });
    if (r.count === 1) await tx.interaction.create({ data: dto });
    return r.count === 1;
  });
}
