import { http, requestBlob } from "@/shared/lib/http";
import { downloadBlob } from "@/shared/lib/download";
import type { LeadFilters, LeadList } from "../types";

export const TABLE_LIMIT = 20;

export function listLeads(filters: LeadFilters, page: number, signal?: AbortSignal): Promise<LeadList> {
  return http.get<LeadList>("/api/leads", { ...filters, page, limit: TABLE_LIMIT }, signal);
}

export async function downloadSearchCsv(searchId: number): Promise<void> {
  const blob = await requestBlob("/api/leads/export.csv", { query: { search: searchId } });
  downloadBlob(blob, `leads-busqueda-${searchId}.csv`);
}
