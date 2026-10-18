import type { LeadQuality, ContactStatus } from "@/modules/contact";

export type SourceName = "dane" | "osm" | "rnt" | "secop" | "reps";

export interface Phone {
  number: string;
  type: "mobile" | "landline";
  whatsapp?: boolean;
}

export interface ContactedBy {
  id: number;
  fullName: string;
  email: string;
}

export interface Lead {
  id: number;
  name: string;
  legalName: string | null;
  nit: string | null;
  municipality: string;
  department: string;
  address: string | null;
  phones: Phone[];
  emails: string[];
  websites: string[];
  socialLinks: string[];
  contactable: boolean;
  contacted?: boolean;
  contactedAt?: string | null;
  contactedById?: number | null;
  /** Who pressed "Contact". */
  contactedBy?: ContactedBy | null;
  contactStatus?: ContactStatus;
  lastContactedAt?: string | null;
  repliedAt?: string | null;
  /** Asked not to be contacted again. */
  doNotContact?: boolean;
  quality?: LeadQuality | null;
  score?: number | null;
  sources: SourceName[];
}

export interface LeadList {
  total: number;
  page: number;
  limit: number;
  leads: Lead[];
}

/** GET /api/leads filters (see the API README). */
export interface LeadFilters {
  search?: number;
  contacted?: boolean;
  /** true = only the ones I contacted; without a value = the whole team's. */
  mine?: boolean;
  /** Only the ones contacted by this user (id). */
  contacted_by?: number;
  /** Funnel statuses separated by commas (e.g. "REPLIED,INTERESTED"). */
  status?: string;
  /** Qualities separated by commas; "NONE" = not qualified. */
  quality?: string;
  municipality?: string;
  department?: string;
  category?: string;
  source?: SourceName;
  contactable?: boolean;
  q?: string;
}
