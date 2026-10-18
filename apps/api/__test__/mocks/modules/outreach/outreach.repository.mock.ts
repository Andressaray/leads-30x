// In-memory outreach repository, with the same signature as the real one (for domain tests).
import type { OutreachRepository } from 'modules/outreach/domain/outreach.domain';
import type { CreateInteractionDTO, InteractionDTO, LeadContactDTO, ReplyResult } from 'modules/outreach/types/outreach.types';

export interface InMemoryOutreachRepository extends OutreachRepository {
  _status: { leads: LeadContactDTO[]; interactions: InteractionDTO[] };
}

const USERS: Record<number, { fullName: string; email: string }> = {
  1: { fullName: 'Andres Saray', email: 'andres@gmail.com' },
  2: { fullName: 'Camila Rojas', email: 'camila@gmail.com' },
  3: { fullName: 'Administrador', email: 'admin@gmail.com' },
};

export function testLead(p: Partial<LeadContactDTO> = {}): LeadContactDTO {
  return {
    id: 1, name: 'Café Prueba', municipality: 'SAN JOSÉ DEL GUAVIARE', department: 'Guaviare', categories: ['restaurant'],
    phones: [{ number: '+573001112233', type: 'mobile', whatsapp: true }, { number: '+576015550000', type: 'landline' }],
    emails: ['hola@cafe.test'], contacted: false, contactedAt: null, contactedById: null, contactedBy: null,
    contactStatus: 'PENDING', lastContactedAt: null, repliedAt: null, doNotContact: false, doNotContactAt: null,
    quality: null, score: null, qualifiedAt: null, ...p,
  };
}

export function createInMemoryOutreachRepository(initialLeads: LeadContactDTO[] = [testLead()]): InMemoryOutreachRepository {
  const leads = initialLeads.map((l) => structuredClone(l));
  const interactions: InteractionDTO[] = [];
  let nextId = 1;
  const byId = (id: number) => leads.find((l) => l.id === id);

  function create(dto: CreateInteractionDTO, date: Date): InteractionDTO {
    const u = dto.userId ? USERS[dto.userId] : undefined;
    const i: InteractionDTO = { ...dto, id: nextId++, user: u ? { id: dto.userId!, fullName: u.fullName } : null, createdAt: date };
    interactions.push(i);
    return structuredClone(i);
  }

  const repo = {
    _status: { leads, interactions },
    async findLeadContact(id: number) {
      const l = byId(id);
      if (!l) return null;
      const u = l.contactedById ? USERS[l.contactedById] : undefined;
      return structuredClone({ ...l, contactedBy: u ? { id: l.contactedById!, ...u } : null });
    },
    async findInteractions(leadId: number) {
      return interactions.filter((i) => i.leadId === leadId).reverse().map((i) => structuredClone(i));
    },
    async findOutboundSince(leadId: number, from: Date) {
      return interactions
        .filter((i) => i.leadId === leadId && i.direction === 'OUTBOUND' && i.status !== 'FAILED' && i.createdAt >= from)
        .reverse()
        .map((i) => ({ channel: i.channel, createdAt: i.createdAt }));
    },
    async createInteraction(dto: CreateInteractionDTO) {
      return create(dto, new Date());
    },
    async saveOutbound(dto: CreateInteractionDTO, now: Date) {
      const l = byId(dto.leadId)!;
      if (!l.contacted && dto.userId) Object.assign(l, { contacted: true, contactedAt: now, contactedById: dto.userId });
      if (l.contactStatus === 'PENDING') l.contactStatus = 'CONTACTED';
      l.lastContactedAt = now;
      return create(dto, now);
    },
    async saveReply(dto: CreateInteractionDTO, result: ReplyResult, now: Date) {
      const l = byId(dto.leadId)!;
      l.contactStatus = result;
      if (result !== 'BOUNCED' && !l.repliedAt) l.repliedAt = now;
      return create(dto, now);
    },
    async markDoNotContact(dto: CreateInteractionDTO, now: Date) {
      const l = byId(dto.leadId)!;
      if (l.doNotContact) return false;
      Object.assign(l, { doNotContact: true, doNotContactAt: now });
      create(dto, now);
      return true;
    },
  };
  return repo as unknown as InMemoryOutreachRepository;
}
