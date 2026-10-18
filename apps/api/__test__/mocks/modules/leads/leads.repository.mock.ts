// In-memory leads repository, with the same signature as the real one.
// Domain tests use it to exercise the matching rules without a database.

import type { SourceName } from '~types/source.types';
import type { LeadsRepository } from 'modules/leads/domain/leads.domain';
import type {
  OccurrenceDTO,
  KeyDTO,
  CreateLeadDTO,
  LeadFiltersDTO,
  LeadDTO,
  LeadRecordResult,
  UpdateLeadDTO,
} from 'modules/leads/types/leads.types';

interface Occurrence extends OccurrenceDTO {
  leadId: number;
}

export interface InMemoryLeadsRepository extends LeadsRepository {
  _status: {
    leads: LeadDTO[];
    keys: Map<string, number>;
    occurrences: Occurrence[];
    searchLeads: { searchId: number; leadId: number; source: SourceName; result: LeadRecordResult }[];
  };
}

export function createInMemoryLeadsRepository(): InMemoryLeadsRepository {
  const leads: LeadDTO[] = [];
  const keys = new Map<string, number>();
  const occurrences: Occurrence[] = [];
  const searchLeads: InMemoryLeadsRepository['_status']['searchLeads'] = [];
  let nextId = 1;
  // Known users (to return contactedBy the way Prisma's include would).
  const users = new Map<number, { fullName: string; email: string }>([
    [1, { fullName: 'Andres Saray', email: 'andres@gmail.com' }],
    [2, { fullName: 'Camila Rojas', email: 'camila@gmail.com' }],
  ]);

  const copy = (l: LeadDTO): LeadDTO => structuredClone(l);
  const byId = (id: number) => leads.find((l) => l.id === id);

  function matches(l: LeadDTO, f: Partial<LeadFiltersDTO>): boolean {
    if (f.searchId && !searchLeads.some((b) => b.searchId === f.searchId && b.leadId === l.id)) return false;
    if (f.municipalityCode && l.municipalityCode !== f.municipalityCode) return false;
    if (f.departmentCode && !l.municipalityCode.startsWith(f.departmentCode)) return false;
    if (f.category && !l.categories.includes(f.category)) return false;
    if (f.source && !l.sources.includes(f.source)) return false;
    if (f.contactable !== undefined && l.contactable !== f.contactable) return false;
    if (f.contacted !== undefined && l.contacted !== f.contacted) return false;
    if (f.contactedById !== undefined && l.contactedById !== f.contactedById) return false;
    if (f.statuses?.length && !f.statuses.includes(l.contactStatus ?? 'PENDING')) return false;
    if (f.qualities?.length && !f.qualities.includes(l.quality ?? 'NONE')) return false;
    if (f.inBoth && l.sourceCount <= 1) return false;
    if (f.individuals === false && l.isIndividual === true) return false;
    if (f.individuals === true && l.isIndividual !== true) return false;
    if (f.q && !(l.name.toLowerCase().includes(f.q.toLowerCase()) || l.nit === f.q)) return false;
    return true;
  }

  const repo = {
    _status: { leads, keys, occurrences, searchLeads },

    async findLeadByOccurrence(source: SourceName, externalId: string) {
      const a = occurrences.find((x) => x.source === source && x.externalId === externalId);
      const l = a && byId(a.leadId);
      return l ? copy(l) : null;
    },
    async findLeadByKey(type: string, value: string) {
      const id = keys.get(`${type}|${value}`);
      const l = id !== undefined ? byId(id) : undefined;
      return l ? copy(l) : null;
    },
    async findNearbyLeads(municipalityCode: string, lat: number, lon: number, delta: number) {
      return leads
        .filter((l) => l.municipalityCode === municipalityCode && l.lat !== null && l.lon !== null && Math.abs(l.lat - lat) <= delta && Math.abs(l.lon - lon) <= delta)
        .map(copy);
    },
    async findLeadsByAddress(municipalityCode: string, addressNorm: string) {
      return leads.filter((l) => l.municipalityCode === municipalityCode && l.addressNorm === addressNorm).map(copy);
    },
    async findLeadsByWord(municipalityCode: string, word: string) {
      return leads.filter((l) => l.municipalityCode === municipalityCode && l.namesNorm.includes(word)).map(copy);
    },
    async createLead(dto: CreateLeadDTO) {
      const now = new Date();
      const lead: LeadDTO = {
        ...structuredClone(dto),
        contacted: dto.contacted ?? false,
        contactedAt: dto.contactedAt ?? null,
        contactedById: dto.contactedById ?? null,
        id: nextId++,
        createdAt: now,
        updatedAt: now,
      };
      leads.push(lead);
      return copy(lead);
    },
    async updateLead(id: number, dto: UpdateLeadDTO) {
      const l = byId(id);
      if (!l) throw new Error(`lead ${id} no existe`);
      Object.assign(l, structuredClone(dto), { updatedAt: new Date() });
      return copy(l);
    },
    async assignContact(id: number, userId: number) {
      const l = byId(id);
      if (!l || l.contacted) return false;
      Object.assign(l, { contacted: true, contactedAt: new Date(), contactedById: userId, updatedAt: new Date() });
      return true;
    },
    async findLead(id: number) {
      const l = byId(id);
      if (!l) return null;
      const u = l.contactedById ? users.get(l.contactedById) : undefined;
      return { ...copy(l), contactedBy: u ? { id: l.contactedById!, ...u } : null };
    },
    async createKeys(leadId: number, list: KeyDTO[]) {
      let n = 0;
      for (const c of list) {
        const k = `${c.type}|${c.value}`;
        if (!keys.has(k)) {
          keys.set(k, leadId);
          n += 1;
        }
      }
      return n;
    },
    async upsertOccurrence(a: { leadId: number; source: SourceName; externalId: string; match: string; data: unknown; searchId: number }) {
      const existing = occurrences.find((x) => x.source === a.source && x.externalId === a.externalId);
      if (existing) {
        Object.assign(existing, { data: a.data, searchId: a.searchId, lastSeen: new Date() });
      } else {
        occurrences.push({ ...a, firstSeen: new Date(), lastSeen: new Date() });
      }
    },
    async createSearchLead(searchId: number, leadId: number, source: SourceName, result: LeadRecordResult) {
      if (!searchLeads.some((b) => b.searchId === searchId && b.leadId === leadId && b.source === source)) {
        searchLeads.push({ searchId, leadId, source, result });
      }
    },
    async countLeads(f: Partial<LeadFiltersDTO>) {
      return leads.filter((l) => matches(l, f)).length;
    },
    async findLeads(f: LeadFiltersDTO) {
      return leads
        .filter((l) => matches(l, f))
        .sort((a, b) => Number(b.contactable) - Number(a.contactable) || b.sourceCount - a.sourceCount || a.id - b.id)
        .slice((f.page - 1) * f.limit, f.page * f.limit)
        .map(copy);
    },
    async countNewLeadsOfSearch(searchId: number) {
      return new Set(searchLeads.filter((b) => b.searchId === searchId && b.result === 'new').map((b) => b.leadId)).size;
    },
    async findLeadDetail(id: number) {
      const l = byId(id);
      if (!l) return null;
      return { ...copy(l), occurrences: occurrences.filter((a) => a.leadId === id).map(({ leadId: _l, ...a }) => a) };
    },
    async findStatsBySource() {
      const bySource = new Map<string, Set<number>>();
      for (const a of occurrences) {
        if (!bySource.has(a.source)) bySource.set(a.source, new Set());
        bySource.get(a.source)!.add(a.leadId);
      }
      return [...bySource].map(([source, ids]) => {
        const ls = [...ids].map(byId).filter((l): l is LeadDTO => Boolean(l));
        return { source, leads: ls.length, contactables: ls.filter((l) => l.contactable).length, attributed: ls.filter((l) => l.originSource === source).length };
      });
    },
  };
  return repo as unknown as InMemoryLeadsRepository;
}
