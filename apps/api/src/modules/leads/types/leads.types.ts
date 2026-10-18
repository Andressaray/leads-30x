import type { Candidate, Municipality, SourceName, Phone } from '~types/source.types';
import type { ContactStatus } from 'modules/outreach/types/outreach.types';

export type PrimaryChannel = 'whatsapp' | 'mobile' | 'landline' | 'email' | 'web' | 'social';

export interface LeadDTO {
  id: number;
  name: string;
  tradeName: string | null;
  legalName: string | null;
  namesNorm: string;
  nit: string | null;
  municipalityCode: string;
  municipality: string;
  department: string;
  address: string | null;
  addressNorm: string | null;
  lat: number | null;
  lon: number | null;
  ciiu: string | null;
  sourceCategory: string | null;
  categories: string[];
  phones: Phone[];
  emails: string[];
  websites: string[];
  socialLinks: string[];
  primaryChannel: PrimaryChannel | null;
  contactable: boolean;
  contacted?: boolean;
  contactedAt?: Date | null;
  /** User the lead was assigned to when they pressed "Contact". */
  contactedById?: number | null;
  /** Only in listings and detail: who contacted it. */
  contactedBy?: ContactedByDTO | null;
  /** Contact funnel (only the outreach module changes it). */
  contactStatus?: ContactStatus;
  lastContactedAt?: Date | null;
  repliedAt?: Date | null;
  /** Asked not to be contacted again. */
  doNotContact?: boolean;
  /** Latest qualification (Dapta or manual). Only the qualifications module changes it. */
  quality?: 'HIGH' | 'MEDIUM' | 'LOW' | 'DISCARDED' | null;
  score?: number | null;
  qualifiedAt?: Date | null;
  isIndividual: boolean | null;
  sources: SourceName[];
  sourceCount: number;
  originSource: SourceName;
  originSearchId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactedByDTO {
  id: number;
  fullName: string;
  email: string;
}

export type CreateLeadDTO = Omit<LeadDTO, 'id' | 'createdAt' | 'updatedAt' | 'contactedBy'>;
export type UpdateLeadDTO = Partial<CreateLeadDTO>;

export interface OccurrenceDTO {
  source: SourceName;
  externalId: string;
  match: string;
  data: unknown;
  searchId: number | null;
  firstSeen: Date;
  lastSeen: Date;
}

export interface LeadDetailDTO extends LeadDTO {
  occurrences: OccurrenceDTO[];
}

export type KeyType = 'nit' | 'phone' | 'email' | 'domain';

export interface KeyDTO {
  type: KeyType;
  value: string;
}

export interface LeadFiltersDTO {
  searchId?: number;
  municipalityCode?: string;
  departmentCode?: string;
  category?: string;
  source?: SourceName;
  contactable?: boolean;
  contacted?: boolean;
  /** Only the leads contacted by this user. */
  contactedById?: number;
  /** One or more funnel statuses. */
  statuses?: ContactStatus[];
  /** One or more qualities; "NONE" = not qualified. */
  qualities?: string[];
  inBoth?: boolean;
  individuals?: boolean;
  q?: string;
  limit: number;
  page: number;
}

export interface LeadListDTO {
  total: number;
  page: number;
  limit: number;
  leads: LeadDTO[];
}

export type LeadRecordResult = 'new' | 'enriched' | 'unchanged';

export interface RecordContextDTO {
  municipality: Municipality;
  category: string | null;
  searchId: number;
}

export interface RecordCountDTO {
  records: number;
  new: number;
  enriched: number;
  unchanged: number;
  skipped: number;
}

export interface SearchLeadsSummaryDTO {
  leads: number;
  new: number;
  contactables: number;
  inMultipleSources: number;
}

export interface SourceStatsDTO {
  source: string;
  leads: number;
  contactables: number;
  attributed: number;
}

export type { Candidate };
