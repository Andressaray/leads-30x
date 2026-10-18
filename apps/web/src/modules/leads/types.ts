import type { CalidadLead, EstadoContacto } from "@/modules/contacto";

export type NombreFuente = "dane" | "osm" | "rnt" | "secop" | "reps";

export interface Telefono {
  numero: string;
  tipo: "movil" | "fijo";
  whatsapp?: boolean;
}

export interface ContactadoPor {
  id: number;
  fullName: string;
  email: string;
}

export interface Lead {
  id: number;
  nombre: string;
  razonSocial: string | null;
  nit: string | null;
  municipio: string;
  departamento: string;
  direccion: string | null;
  telefonos: Telefono[];
  emails: string[];
  sitiosWeb: string[];
  redes: string[];
  contactable: boolean;
  contactado?: boolean;
  contactadoEn?: string | null;
  contactadoPorId?: number | null;
  /** Quién le dio "Contactar". */
  contactadoPor?: ContactadoPor | null;
  estadoContacto?: EstadoContacto;
  ultimoContactoEn?: string | null;
  respondioEn?: string | null;
  /** Pidió no volver a ser contactado. */
  noContactar?: boolean;
  calidad?: CalidadLead | null;
  puntaje?: number | null;
  fuentes: NombreFuente[];
}

export interface ListadoLeads {
  total: number;
  pagina: number;
  limite: number;
  leads: Lead[];
}

/** Filtros de GET /api/leads (ver README de la API). */
export interface FiltrosLeads {
  busqueda?: number;
  contactado?: boolean;
  /** true = solo los que contacté yo; sin valor = los de todo el equipo. */
  mios?: boolean;
  /** Solo los que contactó este usuario (id). */
  contactado_por?: number;
  /** Estados del embudo separados por coma (ej. "RESPONDIO,INTERESADO"). */
  estado?: string;
  /** Calidades separadas por coma; "SIN" = sin calificar. */
  calidad?: string;
  municipio?: string;
  departamento?: string;
  categoria?: string;
  fuente?: NombreFuente;
  contactable?: boolean;
  q?: string;
}
