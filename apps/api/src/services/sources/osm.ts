// OpenStreetMap source through the Overpass API.
// 1) Finds the municipality boundary by its DIVIPOLA code ("divipola" tag
//    of Colombia's administrative relations in OSM).
// 2) If the municipality does not have that tag, it searches within a radius around the center.
// Data © OpenStreetMap contributors, ODbL license.

import type { Candidate, SourceFilter, LeadSource, Municipality, Phone } from '~types/source.types';
import { parseOsmTag } from '~config/catalog/categories';
import { extractHost, normalizeDomain, normalizeEmails, normalizePhones } from '~utils/normalize';
import { SourceError, wait, requestJson, type FetchLike } from './http';

export const DEFAULT_OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function overpassFilter(label: string): string {
  const t = parseOsmTag(label);
  if (!t) throw new SourceError(`Etiqueta OSM inválida: ${label}`);
  return t.value === undefined ? `["${t.key}"]` : `["${t.key}"="${t.value}"]`;
}

export function queryByDivipola(municipalityCode: string, tags: string[], timeoutS: number): string {
  if (!/^\d{5}$/.test(municipalityCode)) throw new SourceError('Código de municipio inválido.');
  const filters = tags.map(overpassFilter);
  return [
    `[out:json][timeout:${Math.round(timeoutS)}];`,
    `rel["boundary"="administrative"]["divipola"="${municipalityCode}"]->.limite;`,
    '.limite out ids;',
    '.limite map_to_area->.zona;',
    '(',
    ...filters.map((f) => `  nwr(area.zona)${f}["name"];`),
    ');',
    'out center tags;',
  ].join('\n');
}

export function queryByRadius(lat: number, lon: number, radioM: number, tags: string[], timeoutS: number): string {
  if (![lat, lon, radioM].every(Number.isFinite)) throw new SourceError('Coordenadas inválidas.');
  const filters = tags.map(overpassFilter);
  const scope = `(around:${Math.round(radioM)},${lat.toFixed(6)},${lon.toFixed(6)})`;
  return [
    `[out:json][timeout:${Math.round(timeoutS)}];`,
    '(',
    ...filters.map((f) => `  nwr${scope}${f}["name"];`),
    ');',
    'out center tags;',
  ].join('\n');
}

const CATEGORY_KEYS = ['shop', 'amenity', 'office', 'craft', 'tourism', 'healthcare', 'leisure'];

export function osmToCandidate(el: OsmElement, municipality: Municipality): Candidate {
  const t = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat ?? null;
  const lon = el.lon ?? el.center?.lon ?? null;

  const phones: Phone[] = normalizePhones(
    [t.phone, t['contact:phone'], t.mobile, t['contact:mobile'], t['phone:mobile']],
    municipality.departmentCode
  );
  for (const w of normalizePhones([t['contact:whatsapp'], t.whatsapp], municipality.departmentCode)) {
    const existing = phones.find((x) => x.number === w.number);
    if (existing) existing.whatsapp = true;
    else phones.push({ ...w, whatsapp: true });
  }

  const websites: string[] = [];
  const socialLinks: string[] = [];
  for (const url of [t.website, t['contact:website'], t.url].filter(Boolean)) {
    if (!extractHost(url)) continue;
    if (normalizeDomain(url)) websites.push(url.trim());
    else socialLinks.push(url.trim());
  }
  for (const k of ['contact:facebook', 'facebook', 'contact:instagram', 'instagram', 'contact:tiktok']) {
    if (t[k]) socialLinks.push(t[k].trim());
  }

  const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' # ');
  const categoryKey = CATEGORY_KEYS.find((c) => t[c]);

  return {
    source: 'osm',
    externalId: `${el.type}/${el.id}`,
    name: t.name ?? null,
    legalName: null,
    tradeName: t.name ?? null,
    nit: null,
    municipalityCode: municipality.code,
    address: t['addr:full'] || street || null,
    lat,
    lon,
    ciiu: null,
    sourceCategory: categoryKey ? `${categoryKey}=${t[categoryKey]}` : null,
    phones,
    emails: normalizeEmails([t.email, t['contact:email']]),
    websites: [...new Set(websites)],
    socialLinks: [...new Set(socialLinks)],
    isIndividual: null,
    raw: { type: el.type, id: el.id, lat, lon, tags: t },
  };
}

export function createOsmSource(
  o: {
    endpoints?: string[];
    /** Maximum wait per Overpass server */
    timeoutMs?: number;
    /** Maximum total wait of the source, adding retries and the radius search */
    budgetMs?: number;
    fallbackRadiusM?: number;
    userAgent?: string;
    maxBytes?: number;
    retryPauseMs?: number;
    fetchImpl?: FetchLike;
    now?: () => number;
  } = {}
): LeadSource {
  const endpoints = o.endpoints ?? DEFAULT_OVERPASS;
  const timeoutMs = o.timeoutMs ?? 60000;
  const budgetMs = o.budgetMs ?? 100000;
  const fallbackRadiusM = o.fallbackRadiusM ?? 4000;
  const pause = o.retryPauseMs ?? 1000;
  const now = o.now ?? Date.now;
  /** Below this it is not worth sending another query to Overpass */
  const MIN_USEFUL_MS = 10000;

  /**
   * Tries the servers in order until one responds or time runs out.
   * The query is built on each attempt so that the [timeout:] requested from
   * Overpass never exceeds what is left of the budget.
   */
  async function run(assemble: (timeoutS: number) => string, expires: number): Promise<{ elements?: OsmElement[] }> {
    let lastError: SourceError | undefined;
    for (let i = 0; i < endpoints.length; i += 1) {
      const remaining = expires - now();
      if (remaining < MIN_USEFUL_MS) break;
      const waitMs = Math.min(timeoutMs, remaining);
      const timeoutS = Math.max(5, Math.floor(waitMs / 1000) - 5);
      try {
        return await requestJson(endpoints[i], {
          method: 'POST',
          body: new URLSearchParams({ data: assemble(timeoutS) }).toString(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'User-Agent': o.userAgent ?? 'leads-colombia/2.0',
          },
          timeoutMs: waitMs,
          maxBytes: o.maxBytes ?? 80e6,
          fetchImpl: o.fetchImpl,
        });
      } catch (err) {
        lastError = err as SourceError;
        if (!lastError.retryable) throw err;
        if (i < endpoints.length - 1) {
          const pauseMs = Math.min(lastError.retryAfterMs ?? pause, 30000);
          if (expires - now() - pauseMs < MIN_USEFUL_MS) break;
          await wait(pauseMs);
        }
      }
    }
    const reason = lastError?.message ?? `se agotó el tiempo total de ${Math.round(budgetMs / 1000)} s`;
    throw new SourceError(`Overpass no respondió (${reason}). Intenta de nuevo en unos minutos.`, { retryable: true });
  }

  return {
    name: 'osm',
    description: 'OpenStreetMap (Overpass API) – negocios del mapa con nombre comercial y, a veces, teléfono y web',
    async search(municipality: Municipality, filter: SourceFilter) {
      if (!filter.values.length) return { candidates: [], meta: { skipped: 'sin etiquetas OSM' } };
      const expires = now() + budgetMs;

      let data = await run((t) => queryByDivipola(municipality.code, filter.values, t), expires);
      let elements = data.elements ?? [];
      const limit = elements.filter((e) => e.type === 'relation' && !e.tags);
      let scope = 'municipal_boundary';
      if (limit.length === 0) {
        scope = `radius_${fallbackRadiusM}m`;
        data = await run((t) => queryByRadius(municipality.lat, municipality.lon, fallbackRadiusM, filter.values, t), expires);
        elements = data.elements ?? [];
      }
      const candidates = elements.filter((e) => e.tags?.name).map((e) => osmToCandidate(e, municipality));
      return {
        candidates,
        meta: { scope, osmRelation: limit.map((r) => r.id), attribution: '© OpenStreetMap contributors (ODbL)' },
      };
    },
  };
}
