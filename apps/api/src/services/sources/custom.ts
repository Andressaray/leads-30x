// Source added by the team: any datos.gov.co (Socrata) dataset with
// businesses per municipality. Nothing is coded: you indicate which column holds the
// municipality, the name, the NIT, the phone, etc. (see /api/sources).

import type { Candidate, SourceFilter, LeadSource, Municipality } from '~types/source.types';
import {
  extractHost,
  normalizeDomain,
  normalizeEmails,
  normalizeNit,
  normalizePhones,
  normalizeText,
  looksLikeCompanyNit,
  usefulValue,
} from '~utils/normalize';
import { SourceError, requestJson, type FetchLike } from './http';
import { DATOS_GOV_BASE, literalSoql, type QuerySocrata } from './socrata';

export const PATRON_DATASET = /^[a-z0-9]{4}-[a-z0-9]{4}$/;
/** Socrata column names: letters, numbers, underscore (and : or @ in computed ones). */
export const COLUMN_PATTERN = /^[a-z_:@][a-z0-9_:@]{0,62}$/i;

/** How the municipality comes in the dataset. */
export const MUNICIPALITY_FORMATS = ['code', 'code_number', 'name'] as const;
export type MunicipalityFormat = (typeof MUNICIPALITY_FORMATS)[number];

/** Which dataset column holds each field. Only municipality and name are required. */
export interface OpenDataFields {
  municipality: string;
  /** code = 5-digit DIVIPOLA as text ("05001"); code_number = number (5001); name = "MEDELLÍN" */
  municipalityFormat: MunicipalityFormat;
  /** Only with the "name" format: department column to tell apart municipalities with the same name. */
  department?: string | null;
  name: string;
  id?: string | null;
  nit?: string | null;
  address?: string | null;
  phones?: string[];
  emails?: string[];
  website?: string | null;
  category?: string | null;
}

export interface OpenDataDefinition {
  key: string;
  name: string;
  dataset: string;
  fields: OpenDataFields;
  /** Extra SoQL condition (e.g. estado='ACTIVO'). */
  condition?: string | null;
  version?: string;
}

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
/** The name as is and without accents, in uppercase: "MEDELLÍN" → ["MEDELLÍN", "MEDELLIN"]. */
const variants = (s: string) => [...new Set([s.toUpperCase(), stripAccents(s).toUpperCase()])];

/** Dataset columns that are used, without repeats. */
export function usedColumns(c: OpenDataFields): string[] {
  const all = [c.municipality, c.department, c.name, c.id, c.nit, c.address, c.website, c.category, ...(c.phones ?? []), ...(c.emails ?? [])];
  return [...new Set(all.filter((x): x is string => Boolean(x)))];
}

/** Validates a definition; returns the problems found (empty = valid). */
export function definitionProblems(d: Pick<OpenDataDefinition, 'dataset' | 'fields' | 'condition'>): string[] {
  const p: string[] = [];
  if (!PATRON_DATASET.test(d.dataset ?? '')) p.push('dataset debe ser un id de datos.gov.co como "abcd-1234".');
  const c = d.fields;
  if (!c?.municipality) p.push('Indica la columna del municipio.');
  if (!c?.name) p.push('Indica la columna del nombre del negocio.');
  if (c && !MUNICIPALITY_FORMATS.includes(c.municipalityFormat)) p.push(`formatoMunicipio debe ser: ${MUNICIPALITY_FORMATS.join(', ')}.`);
  if (c) for (const col of usedColumns(c)) if (!COLUMN_PATTERN.test(col)) p.push(`Nombre de columna inválido: "${col}".`);
  if (d.condition && (/;|--|\/\*/.test(d.condition) || d.condition.length > 300)) p.push('La condición extra no puede tener ";", comentarios ni pasar de 300 caracteres.');
  return p;
}

/** SoQL $where for a municipality. */
export function customQuery(d: Pick<OpenDataDefinition, 'fields' | 'condition'>, municipality: Municipality): string {
  const c = d.fields;
  if (!/^\d{5}$/.test(municipality.code)) throw new SourceError('Código de municipio inválido.');
  let parts: string[];
  if (c.municipalityFormat === 'code') parts = [`${c.municipality}=${literalSoql(municipality.code)}`];
  else if (c.municipalityFormat === 'code_number') parts = [`${c.municipality}=${Number(municipality.code)}`];
  else {
    parts = [`upper(${c.municipality}) in (${variants(municipality.name).map(literalSoql).join(', ')})`];
    if (c.department) parts.push(`upper(${c.department}) in (${variants(municipality.department).map(literalSoql).join(', ')})`);
  }
  if (d.condition?.trim()) parts.push(`(${d.condition.trim()})`);
  return parts.join(' AND ');
}

/** Socrata sometimes returns objects (URL type: { url }) or numbers: everything to text. */
function text(v: unknown): string | null {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return usefulValue(o.url ?? o.phone_number ?? o.human_address ?? null);
  }
  return usefulValue(v);
}

export function rowToCandidate(row: Record<string, unknown>, d: OpenDataDefinition, municipality: Municipality): Candidate | null {
  const c = d.fields;
  const read = (col?: string | null) => (col ? text(row[col]) : null);
  const name = read(c.name);
  if (!name) return null;
  const nit = normalizeNit(read(c.nit));
  const address = read(c.address);
  const web = read(c.website);
  const websites: string[] = [];
  const socialLinks: string[] = [];
  if (web && extractHost(web)) (normalizeDomain(web) ? websites : socialLinks).push(web.toLowerCase());
  const category = read(c.category);
  return {
    source: d.key,
    externalId: read(c.id) ?? nit ?? `${municipality.code}:${normalizeText(name)}:${normalizeText(address)}`,
    name,
    legalName: nit && looksLikeCompanyNit(nit) ? name : null,
    tradeName: name,
    nit,
    municipalityCode: municipality.code,
    address,
    lat: null,
    lon: null,
    ciiu: null,
    sourceCategory: category ? `${d.key.toUpperCase()} ${category}` : null,
    phones: normalizePhones((c.phones ?? []).map(read), municipality.departmentCode),
    emails: normalizeEmails((c.emails ?? []).map(read)),
    websites,
    socialLinks,
    isIndividual: nit ? !looksLikeCompanyNit(nit) : null,
    raw: row,
  };
}

export function createCustomSource(query: QuerySocrata, d: OpenDataDefinition): LeadSource {
  return {
    name: d.key,
    description: d.name,
    version: d.version,
    async search(municipality: Municipality, _filter: SourceFilter, options) {
      const { rows, truncated } = await query<Record<string, unknown>>(d.dataset, {
        $where: customQuery(d, municipality),
        $select: usedColumns(d.fields).join(', '),
      });
      const all = rows.map((f) => rowToCandidate(f, d, municipality)).filter((x): x is Candidate => x !== null);
      const candidates = options.includeIndividuals ? all : all.filter((x) => x.isIndividual !== true);
      return {
        candidates,
        meta: { truncated, unnamed: rows.length - all.length, skipped_individuals: all.length - candidates.length },
      };
    },
  };
}

// ── Dataset inspection (to build the source from the web app) ─────────────

export interface DatasetColumn {
  field: string;
  name: string;
  type: string | null;
}

export interface DatasetInspection {
  dataset: string;
  name: string | null;
  description: string | null;
  link: string;
  columns: DatasetColumn[];
  sample: Record<string, unknown>[];
  suggestion: Partial<OpenDataFields>;
}

export interface InspectionOptions {
  appToken?: string;
  timeoutMs?: number;
  userAgent?: string;
  fetchImpl?: FetchLike;
  /** https://www.datos.gov.co by default */
  site?: string;
}

/** Accepts the id ("abcd-1234") or a datos.gov.co link that contains it. */
export function extractDataset(input: string): string | null {
  const t = String(input ?? '').trim().toLowerCase();
  if (PATRON_DATASET.test(t)) return t;
  // https://www.datos.gov.co/d/thwd-ivmp · /resource/thwd-ivmp.json · /Turismo/Registro-Nacional/thwd-ivmp/about_data
  const m = t.match(/\/(?:d|resource|views|dataset)\/([a-z0-9]{4}-[a-z0-9]{4})/) ?? t.match(/\/([a-z0-9]{4}-[a-z0-9]{4})(?:\.json)?(?:[/?#]|$)/);
  return m?.[1] ?? null;
}

/** Guesses which column is which by its name. The user reviews it before saving. */
export function suggestFields(columns: string[]): Partial<OpenDataFields> {
  const n = columns.map((c) => ({ c, t: normalizeText(c.replace(/_/g, ' ')) }));
  const first = (re: RegExp, avoid?: RegExp) => n.find((x) => re.test(x.t) && !(avoid && avoid.test(x.t)))?.c ?? null;
  const all = (re: RegExp) => n.filter((x) => re.test(x.t)).map((x) => x.c);

  const municipalityCode = first(/(cod|codigo|divipola).*(mun|mpio|ciudad)|(mun|mpio|ciudad).*(cod|codigo|divipola)|^divipola$|cod mun/);
  const municipalityName = first(/municipio|ciudad|mpio/, /cod|codigo|divipola/);
  const s: Partial<OpenDataFields> = {};
  if (municipalityCode) Object.assign(s, { municipality: municipalityCode, municipalityFormat: 'code' as const });
  else if (municipalityName) {
    Object.assign(s, { municipality: municipalityName, municipalityFormat: 'name' as const });
    const department = first(/departamento|dpto/, /cod|codigo/);
    if (department) s.department = department;
  }
  const name =
    first(/razon social|nombre comercial|nombre establecimiento|nombre empresa|nombre prestador|nombre sede/) ?? first(/^nombre$|nombre|razon/, /municipio|departamento|ciudad|contacto|representante|categoria|tipo/);
  if (name) s.name = name;
  const nit = first(/^nit$|nit|numero identificacion|num identificacion|identificacion/, /tipo/);
  if (nit) s.nit = nit;
  const address = first(/direccion|direcci n/, /correo|electronica|web/);
  if (address) s.address = address;
  const phones = all(/telefono|tel fono|celular|movil|whatsapp/);
  if (phones.length) s.phones = phones.slice(0, 3);
  const emails = all(/correo|email|e mail/);
  if (emails.length) s.emails = emails.slice(0, 3);
  const web = first(/sitio web|pagina web|web|url/);
  if (web) s.website = web;
  const category = first(/categoria|actividad|clase|tipo establecimiento|sector/, /cod|codigo/);
  if (category) s.category = category;
  const id = first(/^codigo$|codigo rnt|codigo habilitacion|^id$|registro/, /municipio|departamento|mun|categoria|ciiu|postal/);
  if (id) s.id = id;
  return s;
}

export async function inspectDataset(dataset: string, o: InspectionOptions = {}): Promise<DatasetInspection> {
  if (!PATRON_DATASET.test(dataset)) throw new SourceError(`Dataset inválido: ${dataset}`);
  const site = (o.site ?? DATOS_GOV_BASE.replace(/\/resource$/, '')).replace(/\/$/, '');
  const headers = {
    Accept: 'application/json',
    ...(o.appToken ? { 'X-App-Token': o.appToken } : {}),
    ...(o.userAgent ? { 'User-Agent': o.userAgent } : {}),
  };
  const request = <T>(url: string) => requestJson<T>(url, { headers, timeoutMs: o.timeoutMs ?? 20000, fetchImpl: o.fetchImpl, maxBytes: 5e6 });

  const [meta, sample] = await Promise.all([
    request<{ name?: string; description?: string; columns?: { fieldName?: string; name?: string; dataTypeName?: string }[] }>(`${site}/api/views/${dataset}.json`).catch(
      () => null
    ),
    request<Record<string, unknown>[]>(`${site}/resource/${dataset}.json?$limit=5`),
  ]);
  if (!Array.isArray(sample)) throw new SourceError('datos.gov.co respondió en un formato inesperado.');

  let columns: DatasetColumn[] = (meta?.columns ?? [])
    .filter((c) => c.fieldName && !c.fieldName.startsWith(':'))
    .map((c) => ({ field: c.fieldName!, name: c.name ?? c.fieldName!, type: c.dataTypeName ?? null }));
  if (!columns.length) {
    const seen = new Set(sample.flatMap((f) => Object.keys(f)).filter((k) => !k.startsWith(':')));
    columns = [...seen].map((field) => ({ field, name: field, type: null }));
  }
  return {
    dataset,
    name: meta?.name ?? null,
    description: meta?.description ? meta.description.slice(0, 500) : null,
    link: `${site}/d/${dataset}`,
    columns,
    sample: sample.slice(0, 3),
    suggestion: suggestFields(columns.map((c) => c.field)),
  };
}
