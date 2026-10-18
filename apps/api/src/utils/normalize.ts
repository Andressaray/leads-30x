// Data cleanup. Everything used to compare (deduplicate) goes through
// here, so that two sources that write the same thing differently end up with the
// same key.

import type { Phone } from '~types/source.types';

/** lowercase, no accents, only letters/numbers separated by one space */
export function normalizeText(text: unknown): string {
  if (text === undefined || text === null) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Values the sources use to say "no data". */
export function usefulValue(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^(no provisto|no definido|no aplica|n\/?a|sin dato|sin informacion|null|0|-)$/i.test(normalizeText(s) || s)) return null;
  return s;
}

const IGNORED_WORDS = new Set([
  'sas', 'sa', 'ltda', 'limitada', 'eu', 'cia', 'y', 'bic', 'zomac', 'scs', 'sca',
  'en', 'liquidacion', 'sociedad', 'acciones', 'simplificada', 'anonima',
  'de', 'del', 'la', 'el', 'los', 'las', 'e', 'and', 'co',
]);

/** Company name reduced to its distinctive words. */
export function normalizeCompanyName(name: unknown): string {
  let t = normalizeText(name);
  t = t.replace(/\bs a s\b/g, 'sas').replace(/\bs a\b/g, 'sa').replace(/\be u\b/g, 'eu');
  return t
    .split(' ')
    .filter((p) => p && !IGNORED_WORDS.has(p))
    .join(' ');
}

// Regional area code (since 2021 landlines are 60X + 7 digits).
export const AREA_CODE_BY_DEPARTMENT: Record<string, string> = {
  '11': '1', '25': '1',
  '19': '2', '52': '2', '76': '2',
  '05': '4', '23': '4', '27': '4',
  '08': '5', '13': '5', '20': '5', '44': '5', '47': '5', '70': '5', '88': '5',
  '17': '6', '63': '6', '66': '6',
  '54': '7', '68': '7', '81': '7',
  '15': '8', '18': '8', '41': '8', '50': '8', '73': '8', '85': '8', '86': '8',
  '91': '8', '94': '8', '95': '8', '97': '8', '99': '8',
};

/**
 * Normalizes a Colombian phone number to +57 + 10 digits.
 * @param departmentCode 2 digits, to complete old 7-digit landlines
 */
export function normalizePhone(value: unknown, departmentCode?: string): Phone | null {
  if (!value) return null;
  // "320 72 42 Ext 129": the extension is not part of the number
  const withoutExtension = String(value).split(/\s*(?:ext\.?|extension|extensión|x)\s*\d/i)[0];
  let d = withoutExtension.replace(/\D/g, '');
  if (!d) return null;

  if (d.startsWith('0057')) d = d.slice(4);
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10 && d.startsWith('0') && !d.startsWith('03')) d = d.slice(1);

  if (d.length === 10 && d.startsWith('3')) return { number: `+57${d}`, type: 'mobile' };
  if (d.length === 10 && d.startsWith('60') && /[124-8]/.test(d[2])) return { number: `+57${d}`, type: 'landline' };
  if (d.length === 8 && /[124-8]/.test(d[0])) return { number: `+5760${d}`, type: 'landline' };
  if (d.length === 7 && departmentCode && AREA_CODE_BY_DEPARTMENT[departmentCode]) {
    return { number: `+5760${AREA_CODE_BY_DEPARTMENT[departmentCode]}${d}`, type: 'landline' };
  }
  return null;
}

/** Several phones in one or more fields: "300 1234567; 604 4445555" */
export function normalizePhones(values: unknown, departmentCode?: string): Phone[] {
  const outbound = new Map<string, Phone>();
  for (const value of ([] as unknown[]).concat(values ?? [])) {
    if (!value) continue;
    for (const part of String(value).split(/[;,/|]|\by\b/)) {
      const t = normalizePhone(part, departmentCode);
      if (t && !outbound.has(t.number)) outbound.set(t.number, t);
    }
  }
  return [...outbound.values()];
}

const SHARED_DOMAINS = [
  'facebook.com', 'fb.com', 'instagram.com', 'wa.me', 'whatsapp.com', 'api.whatsapp.com',
  'linktr.ee', 'tiktok.com', 'twitter.com', 'x.com', 'youtube.com', 'linkedin.com',
  'google.com', 'goo.gl', 'maps.app.goo.gl', 'sites.google.com', 'business.site',
  'wixsite.com', 'blogspot.com', 'wordpress.com', 'tripadvisor.com', 'rappi.com.co',
  'ifood.com.co', 'domicilios.com', 'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com',
];

export function extractHost(url: unknown): string | null {
  const v = usefulValue(url);
  if (!v) return null;
  let u = v.toLowerCase();
  if (!/^[a-z]+:\/\//.test(u)) u = `http://${u}`;
  try {
    return new URL(u).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

function isSharedDomain(host: string): boolean {
  return SHARED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

/** The business's own domain, or null if it is a social network / shared site. */
export function normalizeDomain(url: unknown): string | null {
  const host = extractHost(url);
  if (!host || !host.includes('.')) return null;
  return isSharedDomain(host) ? null : host;
}

export function normalizeEmail(value: unknown): string | null {
  const v = usefulValue(value);
  if (!v) return null;
  const e = v.toLowerCase().replace(/^mailto:/, '');
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export function normalizeEmails(values: unknown[]): string[] {
  return [...new Set(values.flatMap((v) => String(v ?? '').split(/[;,\s]+/)).map(normalizeEmail).filter((e): e is string => Boolean(e)))];
}

export function normalizeNit(value: unknown): string | null {
  const v = usefulValue(value);
  if (!v) return null;
  const base = v.split('-')[0].replace(/\D/g, '');
  return base.length >= 6 ? base : null;
}

/**
 * NITs of legal entities in Colombia have 9 digits and start with 8 or 9.
 * A different number is usually a cédula (individual).
 */
export function looksLikeCompanyNit(nit: string | null): boolean {
  return Boolean(nit && /^[89]\d{8}$/.test(nit));
}

// Colombian urban street naming: "Carrera 50 # 46-23" and "KR 50 46 23 BR CENTRO"
// are the same street number.
const STREET_TYPES: Record<string, string> = {
  carrera: 'kr', cra: 'kr', cr: 'kr', kr: 'kr', kra: 'kr', crr: 'kr', carrara: 'kr', k: 'kr',
  calle: 'cl', cll: 'cl', cl: 'cl', cal: 'cl', c: 'cl',
  diagonal: 'dg', dg: 'dg', diag: 'dg',
  transversal: 'tv', tv: 'tv', tr: 'tv', trans: 'tv', transv: 'tv', tranv: 'tv',
  avenida: 'av', av: 'av', avda: 'av', ak: 'ak', ac: 'ac',
  circular: 'cq', cq: 'cq', cir: 'cq',
};

/** Reduces an address to its street number: "kr 50 46 23", "dg 50b 46 16"; null if it does not have that format. */
export function normalizeAddress(address: unknown): string | null {
  const v = usefulValue(address);
  if (!v) return null;
  const words = normalizeText(v)
    .replace(/\b(no|nro|numero|num|n)\b/g, ' ')
    .replace(/\b(\d+)\s+(bis)\b/g, '$1bis')
    .replace(/\b(\d+)\s+([a-h])\b/g, '$1$2')
    .replace(/\b(\d+[a-h]?)\s+(bis)\b/g, '$1bis')
    .split(' ')
    .filter(Boolean);
  const start = words.findIndex((p) => STREET_TYPES[p]);
  if (start === -1) return null;
  // "CR 50 CL 46 23": the type of the crossing street is not part of the street number
  const rest = words.slice(start + 1).filter((p) => !STREET_TYPES[p]);
  const [via, a, b, c] = [words[start], ...rest.slice(0, 3)];
  const isNumber = (x?: string) => /^\d+[a-h]?(bis)?$/.test(x || '');
  if (![a, b, c].every(isNumber)) return null;
  const withoutZeros = (x: string) => x.replace(/^0+(?=\d)/, '');
  return `${STREET_TYPES[via]} ${withoutZeros(a)} ${withoutZeros(b)} ${withoutZeros(c)}`;
}

/** Distance in meters between two points. */
export function distanceMeters(
  a: { lat?: number | null; lon?: number | null },
  b: { lat?: number | null; lon?: number | null }
): number {
  if (![a.lat, a.lon, b.lat, b.lon].every((x) => typeof x === 'number' && Number.isFinite(x))) return Infinity;
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat! - a.lat!);
  const dLon = rad(b.lon! - a.lon!);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat!)) * Math.cos(rad(b.lat!)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Words that say the type of business but not which one it is.
const GENERIC_WORDS = new Set([
  'hotel', 'hoteles', 'hostal', 'hostel', 'restaurante', 'restaurant', 'cafeteria', 'cafetria', 'cafe',
  'panaderia', 'pasteleria', 'reposteria', 'drogueria', 'droguerias', 'farmacia', 'ferreteria',
  'supermercado', 'super', 'mercado', 'minimercado', 'tienda', 'tiendas', 'almacen', 'almacenes',
  'bar', 'discoteca', 'licoreria', 'licorera', 'estanco', 'peluqueria', 'barberia', 'sala', 'belleza',
  'spa', 'taller', 'lavadero', 'parqueadero', 'consultorio', 'clinica', 'centro', 'odontologia',
  'odontologico', 'veterinaria', 'veterinario', 'gimnasio', 'gym', 'papeleria', 'miscelanea',
  'comercializadora', 'distribuidora', 'distribuciones', 'inversiones', 'servicios', 'grupo',
  'colombia', 'asociacion', 'corporacion', 'fundacion', 'cooperativa', 'empresa', 'compania',
  'comercial', 'industrial', 'internacional', 'fonda', 'asados', 'pizzeria', 'comidas', 'rapidas',
  'sede', 'principal', 'oficina', 'local', 'punto', 'venta', 'ips', 'eps', 'agencia', 'viajes',
  'turismo', 'transportes', 'transporte',
]);

export function distinctiveWords(name: unknown, ignore?: Set<string>): Set<string> {
  return new Set(
    normalizeCompanyName(name)
      .split(' ')
      .filter((p) => p && !GENERIC_WORDS.has(p) && !(ignore && ignore.has(p)))
  );
}

export interface NameComparison {
  score: number;
  common: number;
  minimum: number;
}

/** Compares two names by their distinctive words (Dice; 0.9 if one contains the other with 2+ words). */
export function compareNames(a: unknown, b: unknown, ignore?: Set<string>): NameComparison {
  const pa = distinctiveWords(a, ignore);
  const pb = distinctiveWords(b, ignore);
  const minimum = Math.min(pa.size, pb.size);
  if (minimum === 0) return { score: 0, common: 0, minimum };
  let common = 0;
  for (const p of pa) if (pb.has(p)) common += 1;
  let score = (2 * common) / (pa.size + pb.size);
  if (common === minimum && minimum >= 2) score = Math.max(score, 0.9);
  return { score, common, minimum };
}

export function nameSimilarity(a: unknown, b: unknown, ignore?: Set<string>): number {
  return compareNames(a, b, ignore).score;
}
