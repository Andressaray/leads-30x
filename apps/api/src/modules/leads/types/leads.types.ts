import type { Candidato, Municipio, NombreFuente, Telefono } from '~types/fuente.types';
import type { EstadoContacto } from 'modules/contactos/types/contactos.types';

export type CanalPrincipal = 'whatsapp' | 'movil' | 'fijo' | 'email' | 'web' | 'red_social';

export interface LeadDTO {
  id: number;
  nombre: string;
  nombreComercial: string | null;
  razonSocial: string | null;
  nombresNorm: string;
  nit: string | null;
  codMpio: string;
  municipio: string;
  departamento: string;
  direccion: string | null;
  direccionNorm: string | null;
  lat: number | null;
  lon: number | null;
  ciiu: string | null;
  categoriaFuente: string | null;
  categorias: string[];
  telefonos: Telefono[];
  emails: string[];
  sitiosWeb: string[];
  redes: string[];
  canalPrincipal: CanalPrincipal | null;
  contactable: boolean;
  contactado?: boolean;
  contactadoEn?: Date | null;
  /** Usuario al que quedó asignado el lead al darle "Contactar". */
  contactadoPorId?: number | null;
  /** Solo en listados y detalle: quién lo contactó. */
  contactadoPor?: ContactadoPorDTO | null;
  /** Embudo de contacto (lo cambia solo el módulo de contactos). */
  estadoContacto?: EstadoContacto;
  ultimoContactoEn?: Date | null;
  respondioEn?: Date | null;
  /** Pidió no volver a ser contactado. */
  noContactar?: boolean;
  /** Última calificación (Dapta o manual). La cambia solo el módulo de calificaciones. */
  calidad?: 'ALTA' | 'MEDIA' | 'BAJA' | 'DESCARTADO' | null;
  puntaje?: number | null;
  calificadoEn?: Date | null;
  esPersonaNatural: boolean | null;
  fuentes: NombreFuente[];
  numFuentes: number;
  fuenteOrigen: NombreFuente;
  busquedaOrigenId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactadoPorDTO {
  id: number;
  fullName: string;
  email: string;
}

export type CreateLeadDTO = Omit<LeadDTO, 'id' | 'createdAt' | 'updatedAt' | 'contactadoPor'>;
export type UpdateLeadDTO = Partial<CreateLeadDTO>;

export interface AparicionDTO {
  fuente: NombreFuente;
  idExterno: string;
  coincidencia: string;
  datos: unknown;
  busquedaId: number | null;
  primeraVez: Date;
  ultimaVez: Date;
}

export interface LeadDetalleDTO extends LeadDTO {
  apariciones: AparicionDTO[];
}

export type TipoClave = 'nit' | 'telefono' | 'email' | 'dominio';

export interface ClaveDTO {
  tipo: TipoClave;
  valor: string;
}

export interface FiltrosLeadsDTO {
  busquedaId?: number;
  codMpio?: string;
  codDpto?: string;
  categoria?: string;
  fuente?: NombreFuente;
  contactable?: boolean;
  contactado?: boolean;
  /** Solo los leads que contactó este usuario. */
  contactadoPorId?: number;
  /** Uno o varios estados del embudo. */
  estados?: EstadoContacto[];
  /** Una o varias calidades; "SIN" = sin calificar. */
  calidades?: string[];
  enAmbas?: boolean;
  personasNaturales?: boolean;
  q?: string;
  limite: number;
  pagina: number;
}

export interface ListadoLeadsDTO {
  total: number;
  pagina: number;
  limite: number;
  leads: LeadDTO[];
}

export type ResultadoRegistroLead = 'nuevo' | 'enriquecido' | 'sin_cambios';

export interface ContextoRegistroDTO {
  municipio: Municipio;
  categoria: string | null;
  busquedaId: number;
}

export interface ConteoRegistroDTO {
  registros: number;
  nuevos: number;
  enriquecidos: number;
  sinCambios: number;
  omitidos: number;
}

export interface ResumenBusquedaLeadsDTO {
  leads: number;
  nuevos: number;
  contactables: number;
  enVariasFuentes: number;
}

export interface EstadisticaFuenteDTO {
  fuente: string;
  leads: number;
  contactables: number;
  atribuidos: number;
}

export type { Candidato };
