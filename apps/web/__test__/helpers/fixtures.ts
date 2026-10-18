import type { Lead } from "@/modules/leads";
import type { SearchResult } from "@/modules/searches";
import type { Session } from "@/shared/lib/session-store";

export const session = (changes: Partial<Session["user"]> = {}): Session => ({
  token: "test-token",
  user: { id: 7, email: "andres@leads.co", fullName: "Andrés Saray", role: "SERVICE", ...changes },
});

let nextId = 1;

export function lead(changes: Partial<Lead> = {}): Lead {
  const id = changes.id ?? nextId++;
  return {
    id,
    name: `Negocio ${id}`,
    legalName: null,
    nit: null,
    municipality: "Medellín",
    department: "Antioquia",
    address: null,
    phones: [],
    emails: [],
    websites: [],
    socialLinks: [],
    contactable: true,
    sources: ["osm"],
    ...changes,
  };
}

export function searchResult(changes: Partial<SearchResult> = {}): SearchResult {
  return {
    searchId: 42,
    status: "complete",
    municipality: { code: "05001", name: "Medellín", department: "Antioquia" },
    filters: { name: "Restaurantes", category: "restaurantes" },
    summary: {
      leads: 120,
      new: 30,
      contactables: 80,
      inMultipleSources: 15,
      bySource: {
        dane: { status: "ok", records: 70, new: 20, enriched: 5, error: null },
        osm: { status: "ok", records: 50, new: 10, enriched: 3, error: null },
      },
    },
    leadsTotal: 120,
    leads: [],
    ...changes,
  };
}
