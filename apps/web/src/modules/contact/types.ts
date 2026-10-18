import type { Phone } from "@/modules/leads";

export type ContactStatus = "PENDING" | "CONTACTED" | "REPLIED" | "INTERESTED" | "NOT_INTERESTED" | "BOUNCED";
export type ReplyResult = Exclude<ContactStatus, "PENDING" | "CONTACTED">;
export type Channel = "EMAIL" | "WHATSAPP" | "CALL" | "OTHER" | "DAPTA";
export type ChannelWithPermission = Exclude<Channel, "OTHER" | "DAPTA">;

export interface Interaction {
  id: number;
  user: { id: number; fullName: string } | null;
  channel: Channel;
  direction: "OUTBOUND" | "INBOUND";
  status: "SENT" | "SIMULATED" | "FAILED" | "RECORDED";
  destination: string | null;
  subject: string | null;
  message: string | null;
  note: string | null;
  result: ContactStatus | null;
  error: string | null;
  createdAt: string;
}

export interface LeadContact {
  id: number;
  name: string;
  municipality: string;
  department: string;
  phones: Phone[];
  emails: string[];
  contactedById: number | null;
  contactedBy: { id: number; fullName: string; email: string } | null;
  contactStatus: ContactStatus;
  lastContactedAt: string | null;
  repliedAt: string | null;
  doNotContact: boolean;
  quality: LeadQuality | null;
  score: number | null;
  qualifiedAt: string | null;
}

export type LeadQuality = "HIGH" | "MEDIUM" | "LOW" | "DISCARDED";

export interface Qualification {
  id: number;
  user: { id: number; fullName: string } | null;
  origin: "DAPTA" | "MANUAL";
  status: "SENT" | "SIMULATED" | "FAILED" | "QUALIFIED" | "NO_CONTACT";
  quality: LeadQuality | null;
  score: number | null;
  summary: string | null;
  error: string | null;
  qualifiedAt: string | null;
  createdAt: string;
}

export interface DaptaStatus {
  mode: "active" | "simulated" | "disabled";
  contacts: boolean;
  webhook: boolean;
  urlWebhook: string | null;
}

export interface DaptaBatchResult {
  sent: number;
  skipped: number;
  results: { leadId: number; ok: boolean; reason: string | null }[];
}

export interface ContactSheet {
  lead: LeadContact;
  interactions: Interaction[];
  channels: { email: string[]; whatsapp: string[]; phone: string[] };
  permission: { reason: string | null; byChannel: Record<ChannelWithPermission, string | null> };
  email: { mode: "smtp" | "simulated" | "disabled" };
  legalHours: boolean;
}

export interface PreparedMessage {
  subject: string | null;
  message: string;
  footer: string;
}

export interface Template {
  id: number;
  name: string;
  channel: ChannelWithPermission;
  subject: string | null;
  body: string;
  active: boolean;
  createdById: number | null;
  createdBy?: { id: number; fullName: string } | null;
}
