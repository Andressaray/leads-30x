// In-memory qualifications repository (domain tests).
import type { QualificationsRepository } from 'modules/qualifications/domain/qualifications.domain';
import type { QualificationDTO, CreateQualificationDTO, LeadForDaptaDTO, QualificationResultDTO } from 'modules/qualifications/types/qualifications.types';

export interface InMemoryQualificationsRepository extends QualificationsRepository {
  _status: { leads: (LeadForDaptaDTO & { quality?: string | null; score?: number | null })[]; qualifications: QualificationDTO[] };
}

export function leadForDapta(p: Partial<LeadForDaptaDTO> = {}): LeadForDaptaDTO {
  return {
    id: 1, name: 'Café Prueba', municipality: 'RIONEGRO', department: 'Antioquia', categories: ['restaurant'],
    phones: [{ number: '+576045550000', type: 'landline' }, { number: '+573001112233', type: 'mobile' }], emails: ['hola@cafe.test'],
    originSource: 'osm', contactStatus: 'PENDING', doNotContact: false, contactedById: null, contactedBy: null, ...p,
  };
}

export function createInMemoryQualificationsRepository(initialLeads = [leadForDapta()]): InMemoryQualificationsRepository {
  const leads = initialLeads.map((l) => ({ ...structuredClone(l), quality: null as string | null, score: null as number | null }));
  const qualifications: QualificationDTO[] = [];
  let id = 1;
  const create = (dto: CreateQualificationDTO): QualificationDTO => {
    const c = { ...structuredClone(dto), id: id++, createdAt: new Date(Date.now() + id) };
    qualifications.push(c);
    return structuredClone(c);
  };
  const repo = {
    _status: { leads, qualifications },
    async findLeadForDapta(leadId: number) {
      const l = leads.find((x) => x.id === leadId);
      return l ? structuredClone(l) : null;
    },
    async findQualifications(leadId: number) {
      return qualifications.filter((c) => c.leadId === leadId).reverse().map((c) => structuredClone(c));
    },
    async findQualificationByReference(reference: string) {
      const c = qualifications.find((x) => x.reference === reference);
      return c ? structuredClone(c) : null;
    },
    async findPendingDispatch(leadId: number, from?: Date) {
      const c = [...qualifications].reverse().find(
        (x) => x.leadId === leadId && x.origin === 'DAPTA' && ['SENT', 'SIMULATED'].includes(x.status) && (!from || x.createdAt >= from)
      );
      return c ? structuredClone(c) : null;
    },
    async createQualification(dto: CreateQualificationDTO) {
      return create(dto);
    },
    async saveResult(cid: number, r: QualificationResultDTO) {
      const c = qualifications.find((x) => x.id === cid)!;
      Object.assign(c, structuredClone(r));
      if (r.status === 'QUALIFIED' && r.quality) Object.assign(leads.find((l) => l.id === c.leadId)!, { quality: r.quality, score: r.score });
      return structuredClone(c);
    },
    async createManualQualification(dto: CreateQualificationDTO) {
      Object.assign(leads.find((l) => l.id === dto.leadId)!, { quality: dto.quality, score: dto.score });
      return create(dto);
    },
  };
  return repo as unknown as InMemoryQualificationsRepository;
}
