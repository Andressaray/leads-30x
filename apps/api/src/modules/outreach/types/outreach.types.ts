import type { EmailMode } from '~services/mail';
import type { Phone } from '~types/source.types';

export const CONTACT_STATUSES = ['PENDING', 'CONTACTED', 'REPLIED', 'INTERESTED', 'NOT_INTERESTED', 'BOUNCED'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** How a lead can end up when its reply is recorded. */
export const REPLY_RESULTS = ['REPLIED', 'INTERESTED', 'NOT_INTERESTED', 'BOUNCED'] as const;
export type ReplyResult = (typeof REPLY_RESULTS)[number];

export const CHANNELS = ['EMAIL', 'WHATSAPP', 'CALL', 'OTHER', 'DAPTA'] as const;
export type ContactChannel = (typeof CHANNELS)[number];

/** Channels recorded by hand (email goes out from the platform). */
export const MANUAL_CHANNELS = ['WHATSAPP', 'CALL', 'OTHER'] as const;
export type ManualChannel = (typeof MANUAL_CHANNELS)[number];

export type InteractionDirection = 'OUTBOUND' | 'INBOUND';
export type InteractionStatus = 'SENT' | 'SIMULATED' | 'FAILED' | 'RECORDED';

export interface InteractionDTO {
  id: number;
  leadId: number;
  userId: number | null;
  user?: { id: number; fullName: string } | null;
  channel: ContactChannel;
  direction: InteractionDirection;
  status: InteractionStatus;
  destination: string | null;
  subject: string | null;
  message: string | null;
  note: string | null;
  result: ContactStatus | null;
  error: string | null;
  providerId: string | null;
  templateId: number | null;
  createdAt: Date;
}

export type CreateInteractionDTO = Omit<InteractionDTO, 'id' | 'user' | 'createdAt'>;

/** What the module needs to know about the lead to contact it. */
export interface LeadContactDTO {
  id: number;
  name: string;
  municipality: string;
  department: string;
  categories: string[];
  phones: Phone[];
  emails: string[];
  contacted: boolean;
  contactedAt: Date | null;
  contactedById: number | null;
  contactedBy: { id: number; fullName: string; email: string } | null;
  contactStatus: ContactStatus;
  lastContactedAt: Date | null;
  repliedAt: Date | null;
  doNotContact: boolean;
  doNotContactAt: Date | null;
  /** Latest qualification (Dapta or manual). */
  quality: 'HIGH' | 'MEDIUM' | 'LOW' | 'DISCARDED' | null;
  score: number | null;
  qualifiedAt: Date | null;
}

/** Previous outbound message (for the hours and frequency rules). */
export interface PreviousOutboundDTO {
  channel: ContactChannel;
  createdAt: Date;
}

export type ChannelWithPermission = 'EMAIL' | 'WHATSAPP' | 'CALL';

export interface ContactPermissionDTO {
  /** null = allowed; otherwise, why not (same reason for every channel). */
  reason: string | null;
  /** Reason per channel (e.g. no email on record), in addition to the general one. */
  byChannel: Record<ChannelWithPermission, string | null>;
}

export interface ContactSheetDTO {
  lead: LeadContactDTO;
  interactions: InteractionDTO[];
  /** Contact data available per channel. */
  channels: { email: string[]; whatsapp: string[]; phone: string[] };
  permission: ContactPermissionDTO;
  email: { mode: EmailMode };
  legalHours: boolean;
}

export interface SendEmailDTO {
  to?: string;
  subject: string;
  message: string;
  templateId?: number;
}

export interface RecordContactDTO {
  channel: ManualChannel;
  destination?: string;
  message?: string;
  note?: string;
  templateId?: number;
}

export interface RecordReplyDTO {
  channel: ContactChannel;
  result: ReplyResult;
  note?: string;
}

export interface PreviewDTO {
  templateId?: number;
  subject?: string;
  body?: string;
}

export interface PreparedMessageDTO {
  subject: string | null;
  message: string;
  /** Legal footer added to emails (identification and how to unsubscribe). */
  footer: string;
}

export interface ContactResultDTO {
  interaction: InteractionDTO;
  lead: LeadContactDTO;
}
