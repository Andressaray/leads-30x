import type { DaptaMode } from '~services/dapta';

export const QUALITIES = ['HIGH', 'MEDIUM', 'LOW', 'DISCARDED'] as const;
export type LeadQuality = (typeof QUALITIES)[number];
export type QualificationOrigin = 'DAPTA' | 'MANUAL';
export type QualificationStatus = 'SENT' | 'SIMULATED' | 'FAILED' | 'QUALIFIED' | 'NO_CONTACT';

export interface QualificationDTO {
  id: number;
  leadId: number;
  userId: number | null;
  user?: { id: number; fullName: string } | null;
  origin: QualificationOrigin;
  status: QualificationStatus;
  reference: string;
  quality: LeadQuality | null;
  score: number | null;
  summary: string | null;
  variables: unknown;
  callId: string | null;
  error: string | null;
  qualifiedAt: Date | null;
  createdAt: Date;
}

export type CreateQualificationDTO = Omit<QualificationDTO, 'id' | 'user' | 'createdAt'>;
export type QualificationResultDTO = Pick<QualificationDTO, 'status' | 'quality' | 'score' | 'summary' | 'variables' | 'callId' | 'error' | 'qualifiedAt'>;

/** What the module needs from the lead to send it to Dapta. */
export interface LeadForDaptaDTO {
  id: number;
  name: string;
  municipality: string;
  department: string;
  categories: string[];
  phones: { number: string; type: 'mobile' | 'landline'; whatsapp?: boolean }[];
  emails: string[];
  originSource: string;
  contactStatus: string;
  doNotContact: boolean;
  contactedById: number | null;
  contactedBy: { id: number; fullName: string } | null;
}

export interface DaptaStatusDTO {
  mode: DaptaMode;
  /** The flow calls the lead: the contact rules apply (Ley 2300). */
  contacts: boolean;
  /** A secret is configured: the webhook accepts results. */
  webhook: boolean;
  /** URL to set in the Dapta flow (null without PUBLIC_URL). */
  urlWebhook: string | null;
}

export interface BatchSendResultDTO {
  sent: number;
  skipped: number;
  results: { leadId: number; ok: boolean; reason: string | null }[];
}

/** Dapta webhook already normalized (the flow may use several field names). */
export interface DaptaResultDTO {
  reference?: string;
  leadId?: number;
  quality: LeadQuality | null;
  score: number | null;
  summary: string | null;
  variables: unknown;
  callId: string | null;
  /** There was no conversation (no answer, voicemail, wrong number). */
  noContact: boolean;
}

export interface QualifyManuallyDTO {
  quality: LeadQuality;
  score?: number;
  note?: string;
}
