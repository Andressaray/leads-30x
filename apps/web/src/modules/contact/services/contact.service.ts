import { http, request } from "@/shared/lib/http";
import type {
  LeadQuality,
  Qualification,
  Channel,
  ChannelWithPermission,
  DaptaStatus,
  ContactSheet,
  Interaction,
  LeadContact,
  PreparedMessage,
  Template,
  DaptaBatchResult,
  ReplyResult,
} from "../types";

interface Result {
  interaction: Interaction;
  lead: LeadContact;
}

export const getContactSheet = (leadId: number, signal?: AbortSignal) => http.get<ContactSheet>(`/api/leads/${leadId}/contact`, undefined, signal);

export const preview = (leadId: number, data: { templateId?: number; subject?: string; body?: string }) =>
  http.post<PreparedMessage>(`/api/leads/${leadId}/contact/preview`, data);

export const sendEmail = (leadId: number, data: { to: string; subject: string; message: string; templateId?: number }) =>
  http.post<Result>(`/api/leads/${leadId}/email`, data);

export const recordContact = (
  leadId: number,
  data: { channel: Exclude<Channel, "EMAIL">; destination?: string; message?: string; note?: string; templateId?: number },
) => http.post<Result>(`/api/leads/${leadId}/interactions`, data);

export const recordReply = (leadId: number, data: { channel: Channel; result: ReplyResult; note?: string }) =>
  http.post<Result>(`/api/leads/${leadId}/reply`, data);

export const markDoNotContact = (leadId: number, note?: string) => http.post<LeadContact>(`/api/leads/${leadId}/do-not-contact`, { note });

export const listTemplates = (channel?: ChannelWithPermission, inactive = false) =>
  http.get<Template[]>("/api/templates", { channel, inactive: inactive || undefined });

export const createTemplate = (data: { name: string; channel: ChannelWithPermission; subject?: string; body: string }) =>
  http.post<Template>("/api/templates", data);

export const updateTemplate = (id: number, data: Partial<Pick<Template, "name" | "subject" | "body" | "active">>) =>
  request<Template>(`/api/templates/${id}`, { method: "PATCH", body: data });

export const listVariables = () => http.get<{ name: string; description: string }[]>("/api/templates/variables");

// Qualification with Dapta (point 4)
export const daptaStatus = () => http.get<DaptaStatus>("/api/dapta/status");
export const listQualifications = (leadId: number) => http.get<Qualification[]>(`/api/leads/${leadId}/qualifications`);
export const sendToDapta = (leadId: number) => http.post<Qualification>(`/api/leads/${leadId}/dapta`);
export const sendBatchToDapta = (leadIds: number[]) => http.post<DaptaBatchResult>("/api/dapta/dispatches", { leadIds });
export const qualifyManually = (leadId: number, data: { quality: LeadQuality; score?: number; note?: string }) =>
  http.post<Qualification>(`/api/leads/${leadId}/qualification`, data);
