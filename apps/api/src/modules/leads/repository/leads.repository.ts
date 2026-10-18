// Lead data access. One function per query, no business rules.

import { prisma, type Prisma } from '~config/db/client';
import type { SourceName, Phone } from '~types/source.types';
import type {
  OccurrenceDTO,
  KeyDTO,
  ContactedByDTO,
  CreateLeadDTO,
  SourceStatsDTO,
  LeadFiltersDTO,
  LeadDetailDTO,
  LeadDTO,
  LeadRecordResult,
  UpdateLeadDTO,
} from '../types/leads.types';

type LeadRow = Prisma.LeadGetPayload<object> & { contactedBy?: ContactedByDTO | null };

/** Who contacted the lead: only the user's public data. */
const WITH_CONTACTED_BY = { contactedBy: { select: { id: true, fullName: true, email: true } } } as const;

function toLeadDTO(f: LeadRow): LeadDTO {
  return {
    ...f,
    phones: (f.phones as unknown as Phone[]) ?? [],
    categories: f.categories ?? [],
    emails: f.emails ?? [],
    websites: f.websites ?? [],
    socialLinks: f.socialLinks ?? [],
    sources: (f.sources ?? []) as SourceName[],
    originSource: f.originSource as SourceName,
    primaryChannel: f.primaryChannel as LeadDTO['primaryChannel'],
  };
}

function toData(dto: UpdateLeadDTO): Prisma.LeadUncheckedUpdateInput {
  // The contact status is only changed by assignContact: a search that enriches the lead
  // must not overwrite it with data read before someone pressed "Contact".
  const {
    phones,
    contacted: _c,
    contactedAt: _e,
    contactedById: _p,
    contactedBy: _u,
    contactStatus: _ec,
    lastContactedAt: _uc,
    repliedAt: _r,
    doNotContact: _n,
    quality: _ca,
    score: _pu,
    qualifiedAt: _cf,
    ...rest
  } = dto as UpdateLeadDTO & Pick<LeadDTO, 'contactedBy'>;
  return { ...rest, ...(phones !== undefined ? { phones: phones as unknown as Prisma.InputJsonValue } : {}) };
}

function buildWhere(f: Partial<LeadFiltersDTO>): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};
  const and: Prisma.LeadWhereInput[] = [];
  if (f.searchId) where.searches = { some: { searchId: f.searchId } };
  if (f.municipalityCode) where.municipalityCode = f.municipalityCode;
  if (f.departmentCode && !f.municipalityCode) where.municipalityCode = { startsWith: f.departmentCode };
  if (f.category) where.categories = { has: f.category };
  if (f.source) where.sources = { has: f.source };
  if (f.contactable !== undefined) where.contactable = f.contactable;
  if (f.contacted !== undefined) where.contacted = f.contacted;
  if (f.contactedById !== undefined) where.contactedById = f.contactedById;
  if (f.statuses?.length) where.contactStatus = { in: f.statuses };
  if (f.qualities?.length) {
    const real = f.qualities.filter((c) => c !== 'NONE') as ('HIGH' | 'MEDIUM' | 'LOW' | 'DISCARDED')[];
    and.push({ OR: [...(real.length ? [{ quality: { in: real } }] : []), ...(f.qualities.includes('NONE') ? [{ quality: null }] : [])] });
  }
  if (f.inBoth) where.sourceCount = { gt: 1 };
  if (f.individuals === false) and.push({ OR: [{ isIndividual: false }, { isIndividual: null }] });
  if (f.individuals === true) where.isIndividual = true;
  if (f.q) {
    and.push({
      OR: [
        { name: { contains: f.q, mode: 'insensitive' } },
        { legalName: { contains: f.q, mode: 'insensitive' } },
        { namesNorm: { contains: f.q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() } },
        { nit: f.q },
      ],
    });
  }
  if (and.length) where.AND = and;
  return where;
}

export async function findLeadByOccurrence(source: SourceName, externalId: string): Promise<LeadDTO | null> {
  const occurrence = await prisma.occurrence.findUnique({
    where: { source_externalId: { source, externalId } },
    include: { lead: true },
  });
  return occurrence ? toLeadDTO(occurrence.lead) : null;
}

export async function findLeadByKey(type: string, value: string): Promise<LeadDTO | null> {
  const key = await prisma.leadKey.findUnique({ where: { type_value: { type, value } }, include: { lead: true } });
  return key ? toLeadDTO(key.lead) : null;
}

export async function findNearbyLeads(municipalityCode: string, lat: number, lon: number, delta: number): Promise<LeadDTO[]> {
  const rows = await prisma.lead.findMany({
    where: { municipalityCode, lat: { gte: lat - delta, lte: lat + delta }, lon: { gte: lon - delta, lte: lon + delta } },
  });
  return rows.map(toLeadDTO);
}

export async function findLeadsByAddress(municipalityCode: string, addressNorm: string): Promise<LeadDTO[]> {
  const rows = await prisma.lead.findMany({ where: { municipalityCode, addressNorm } });
  return rows.map(toLeadDTO);
}

/** Leads of the municipality whose name or legal name contains the word (to match sources without coordinates). */
export async function findLeadsByWord(municipalityCode: string, word: string, limit = 50): Promise<LeadDTO[]> {
  const rows = await prisma.lead.findMany({
    where: { municipalityCode, namesNorm: { contains: word } },
    take: limit,
  });
  return rows.map(toLeadDTO);
}

export async function createLead(dto: CreateLeadDTO): Promise<LeadDTO> {
  const row = await prisma.lead.create({
    data: { ...dto, phones: dto.phones as unknown as Prisma.InputJsonValue },
  });
  return toLeadDTO(row);
}

export async function updateLead(id: number, dto: UpdateLeadDTO): Promise<LeadDTO> {
  const row = await prisma.lead.update({ where: { id }, data: toData(dto) });
  return toLeadDTO(row);
}

/**
 * Assigns the lead to the user only if nobody has contacted it yet (in a single statement,
 * so two people pressing "Contact" at the same time do not overwrite each other). true if it was assigned.
 */
export async function assignContact(id: number, userId: number): Promise<boolean> {
  const r = await prisma.lead.updateMany({
    where: { id, contacted: false },
    data: { contacted: true, contactedAt: new Date(), contactedById: userId },
  });
  if (r.count === 1) {
    // Contacted outside the platform: it enters the funnel as CONTACTED.
    await prisma.lead.updateMany({ where: { id, contactStatus: 'PENDING' }, data: { contactStatus: 'CONTACTED', lastContactedAt: new Date() } });
  }
  return r.count === 1;
}

export async function findLead(id: number): Promise<LeadDTO | null> {
  const row = await prisma.lead.findUnique({ where: { id }, include: WITH_CONTACTED_BY });
  return row ? toLeadDTO(row) : null;
}

export async function createKeys(leadId: number, keys: KeyDTO[]): Promise<number> {
  if (!keys.length) return 0;
  const r = await prisma.leadKey.createMany({
    data: keys.map((c) => ({ ...c, leadId })),
    skipDuplicates: true,
  });
  return r.count;
}

export async function upsertOccurrence(a: {
  leadId: number;
  source: SourceName;
  externalId: string;
  match: string;
  data: unknown;
  searchId: number;
}): Promise<void> {
  const data = (a.data ?? null) as Prisma.InputJsonValue;
  await prisma.occurrence.upsert({
    where: { source_externalId: { source: a.source, externalId: a.externalId } },
    create: { leadId: a.leadId, source: a.source, externalId: a.externalId, match: a.match, data, searchId: a.searchId },
    update: { data, searchId: a.searchId },
  });
}

export async function createSearchLead(searchId: number, leadId: number, source: SourceName, result: LeadRecordResult): Promise<void> {
  await prisma.searchLead.createMany({ data: [{ searchId, leadId, source, result }], skipDuplicates: true });
}

export async function countLeads(filters: Partial<LeadFiltersDTO>): Promise<number> {
  return prisma.lead.count({ where: buildWhere(filters) });
}

export async function findLeads(filters: LeadFiltersDTO): Promise<LeadDTO[]> {
  // In the contacted list, the most recent first.
  const order: Prisma.LeadOrderByWithRelationInput[] =
    filters.contacted === true
      ? [{ contactedAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }]
      : [{ contactable: 'desc' }, { sourceCount: 'desc' }, { id: 'asc' }];
  const rows = await prisma.lead.findMany({
    where: buildWhere(filters),
    include: WITH_CONTACTED_BY,
    orderBy: order,
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
  });
  return rows.map(toLeadDTO);
}

export async function countNewLeadsOfSearch(searchId: number): Promise<number> {
  return prisma.lead.count({ where: { searches: { some: { searchId, result: 'new' } } } });
}

export async function findLeadDetail(id: number): Promise<LeadDetailDTO | null> {
  const row = await prisma.lead.findUnique({ where: { id }, include: { ...WITH_CONTACTED_BY, occurrences: { orderBy: { createdAt: 'asc' } } } });
  if (!row) return null;
  const { occurrences, ...lead } = row;
  return {
    ...toLeadDTO(lead),
    occurrences: occurrences.map(
      (a): OccurrenceDTO => ({
        source: a.source as SourceName,
        externalId: a.externalId,
        match: a.match,
        data: a.data,
        searchId: a.searchId,
        firstSeen: a.createdAt,
        lastSeen: a.updatedAt,
      })
    ),
  };
}

export async function findStatsBySource(): Promise<SourceStatsDTO[]> {
  const rows = await prisma.$queryRaw<{ source: string; leads: bigint; contactables: bigint; attributed: bigint }[]>`
    SELECT o.source,
           COUNT(DISTINCT o.lead_id) AS leads,
           COUNT(DISTINCT CASE WHEN l.contactable THEN l.id END) AS contactables,
           COUNT(DISTINCT CASE WHEN l.origin_source = o.source THEN l.id END) AS attributed
    FROM occurrences o JOIN leads l ON l.id = o.lead_id
    GROUP BY o.source ORDER BY o.source`;
  return rows.map((f) => ({ source: f.source, leads: Number(f.leads), contactables: Number(f.contactables), attributed: Number(f.attributed) }));
}
