// Matching rules across sources (pure functions, no data access).

import type { Candidate, Municipality, Phone } from '~types/source.types';
import {
  compareNames,
  distanceMeters,
  normalizeAddress,
  normalizeDomain,
  normalizeCompanyName,
  normalizeText,
  distinctiveWords,
  type NameComparison,
} from '~utils/normalize';
import type { PrimaryChannel, KeyDTO, CreateLeadDTO, LeadDTO } from '../types/leads.types';

/** ~330 m around the candidate to look for nearby leads. */
export const SEARCH_RADIUS_DEGREES = 0.003;

/**
 * Strong keys of the candidate. They carry the municipality code because
 * leads are per city: the same company in two cities is two leads.
 */
export function candidateKeys(c: Candidate): KeyDTO[] {
  const keys: KeyDTO[] = [];
  const k = (v: string) => `${c.municipalityCode}|${v}`;
  if (c.nit) keys.push({ type: 'nit', value: k(c.nit) });
  for (const t of c.phones) keys.push({ type: 'phone', value: k(t.number) });
  for (const e of c.emails) keys.push({ type: 'email', value: k(e) });
  for (const w of c.websites) {
    const d = normalizeDomain(w);
    if (d) keys.push({ type: 'domain', value: k(d) });
  }
  return keys;
}

function namesOf(x: { name?: string | null; tradeName?: string | null; legalName?: string | null }): string[] {
  return [x.name, x.tradeName, x.legalName].filter((n): n is string => Boolean(n));
}

export function bestComparison(cand: Candidate, lead: LeadDTO, ignore?: Set<string>): NameComparison {
  let best: NameComparison = { score: 0, common: 0, minimum: 0 };
  for (const a of namesOf(cand)) {
    for (const b of namesOf(lead)) {
      const r = compareNames(a, b, ignore);
      if (r.score > best.score || (r.score === best.score && r.common > best.common)) best = r;
    }
  }
  return best;
}

/**
 * Thresholds calibrated with real DANE and OSM data (DANE coordinates come
 * from geocoding addresses and may be off):
 *   2+ distinctive words in common (score ≥ 0.9) ........ up to 300 m
 *   1 identical distinctive word ("Oasis") .............. up to 120 m
 *   score ≥ 0.75 ........................................ up to 80 m
 *   score ≥ 0.6 ......................................... up to 30 m
 */
export function acceptsByNameAndDistance(cmp: NameComparison, meters: number): boolean {
  if (cmp.common >= 2 && cmp.score >= 0.9) return meters <= 300;
  if (cmp.common === 1 && cmp.score === 1) return meters <= 120;
  if (cmp.score >= 0.75) return meters <= 80;
  if (cmp.score >= 0.6) return meters <= 30;
  return false;
}

/** Without coordinates, only a name with 2+ distinctive words in common is accepted. */
export function acceptsByNameWithoutCoordinates(cmp: NameComparison): boolean {
  return cmp.common >= 2 && cmp.score >= 0.9;
}

/** The longest and most distinctive word of the name, to look for candidates in the database. */
export function searchWord(cand: Candidate, ignore?: Set<string>): string | null {
  const words = namesOf(cand).flatMap((n) => [...distinctiveWords(n, ignore)]);
  const sorted = words.filter((p) => p.length >= 4 && !/^\d+$/.test(p)).sort((a, b) => b.length - a.length);
  return sorted[0] ?? null;
}

export function hasCoordinates(x: { lat: number | null; lon: number | null }): boolean {
  return typeof x.lat === 'number' && Number.isFinite(x.lat) && typeof x.lon === 'number' && Number.isFinite(x.lon);
}

export function distance(a: { lat: number | null; lon: number | null }, b: { lat: number | null; lon: number | null }): number {
  return distanceMeters(a, b);
}

export function normalizedNames(x: { name?: string | null; tradeName?: string | null; legalName?: string | null }): string {
  return [...new Set(namesOf(x).map(normalizeText))].join(' | ');
}

export function primaryChannel(lead: Pick<LeadDTO, 'phones' | 'emails' | 'websites' | 'socialLinks'>): PrimaryChannel | null {
  const tels = lead.phones ?? [];
  if (tels.some((t) => t.whatsapp)) return 'whatsapp';
  if (tels.some((t) => t.type === 'mobile')) return 'mobile';
  if (tels.length) return 'landline';
  if (lead.emails?.length) return 'email';
  if (lead.websites?.length) return 'web';
  if (lead.socialLinks?.length) return 'social';
  return null;
}

export function buildLead(cand: Candidate, ctx: { municipality: Municipality; category: string | null; searchId: number }): CreateLeadDTO {
  const base = {
    name: (cand.name ?? cand.legalName ?? '(sin nombre)').trim(),
    tradeName: cand.tradeName,
    legalName: cand.legalName,
    namesNorm: normalizedNames(cand),
    nit: cand.nit,
    municipalityCode: cand.municipalityCode || ctx.municipality.code,
    municipality: ctx.municipality.name,
    department: ctx.municipality.department,
    address: cand.address,
    addressNorm: normalizeAddress(cand.address),
    lat: cand.lat,
    lon: cand.lon,
    ciiu: cand.ciiu,
    sourceCategory: cand.sourceCategory,
    categories: ctx.category ? [ctx.category] : [],
    phones: cand.phones,
    emails: cand.emails,
    websites: cand.websites,
    socialLinks: cand.socialLinks,
    isIndividual: cand.isIndividual,
    sources: [cand.source],
    sourceCount: 1,
    originSource: cand.source,
    originSearchId: ctx.searchId,
  };
  const channel = primaryChannel(base);
  return { ...base, primaryChannel: channel, contactable: Boolean(channel) };
}

function join<T>(list: T[], incoming: T[], key: (x: T) => string = (x) => String(x)): { list: T[]; change: boolean } {
  const seen = new Map(list.map((x) => [key(x), x]));
  let change = false;
  for (const n of incoming) {
    const k = key(n);
    const existing = seen.get(k) as unknown as Phone | undefined;
    if (!existing) {
      seen.set(k, n);
      change = true;
    } else if ((n as unknown as Phone).whatsapp && !existing.whatsapp) {
      seen.set(k, { ...existing, whatsapp: true } as unknown as T);
      change = true;
    }
  }
  return { list: [...seen.values()], change };
}

/** Completes an existing lead with what the candidate brings. Never deletes data. */
export function merge(lead: LeadDTO, cand: Candidate, category: string | null): { lead: LeadDTO; change: boolean } {
  const l: LeadDTO = { ...lead };
  let change = false;
  const fill = <K extends keyof LeadDTO>(field: K, value: LeadDTO[K] | null | undefined) => {
    if (value !== null && value !== undefined && value !== '' && (l[field] === null || l[field] === undefined || l[field] === '')) {
      l[field] = value;
      change = true;
    }
  };

  fill('nit', cand.nit);
  fill('legalName', cand.legalName);
  fill('tradeName', cand.tradeName);
  fill('address', cand.address);
  fill('addressNorm', normalizeAddress(l.address));
  fill('ciiu', cand.ciiu);
  fill('sourceCategory', cand.sourceCategory);

  // If any source confirms it is a company, it stays a company.
  if (cand.isIndividual === false && l.isIndividual !== false) {
    l.isIndividual = false;
    change = true;
  } else if (l.isIndividual === null && cand.isIndividual === true) {
    l.isIndividual = true;
    change = true;
  }

  // The trade name (how people know it) wins over the legal name.
  const preferred = l.tradeName || l.legalName || l.name;
  if (preferred && preferred !== l.name) {
    l.name = preferred;
    change = true;
  }
  const names = [...new Set([...l.namesNorm.split(' | '), ...normalizedNames(cand).split(' | ')].filter(Boolean))].join(' | ');
  if (names !== l.namesNorm) {
    l.namesNorm = names;
    change = true;
  }

  // Coordinates: OSM's are the place itself; DANE's come from geocoding.
  if (cand.source === 'osm' && hasCoordinates(cand) && (!l.sources.includes('osm') || !hasCoordinates(l))) {
    if (l.lat !== cand.lat || l.lon !== cand.lon) {
      l.lat = cand.lat;
      l.lon = cand.lon;
      change = true;
    }
  } else if (!hasCoordinates(l) && hasCoordinates(cand)) {
    l.lat = cand.lat;
    l.lon = cand.lon;
    change = true;
  }

  const lists: [keyof LeadDTO, unknown[], ((x: never) => string) | undefined][] = [
    ['phones', cand.phones, ((t: Phone) => t.number) as (x: never) => string],
    ['emails', cand.emails, undefined],
    ['websites', cand.websites, undefined],
    ['socialLinks', cand.socialLinks, undefined],
    ['sources', [cand.source], undefined],
    ['categories', category ? [category] : [], undefined],
  ];
  for (const [field, incoming, key] of lists) {
    const r = join((l[field] as unknown[]) ?? [], incoming, key as ((x: unknown) => string) | undefined);
    (l as unknown as Record<string, unknown>)[field] = r.list;
    change = change || r.change;
  }
  l.sourceCount = l.sources.length;

  const channel = primaryChannel(l);
  if (channel !== l.primaryChannel) {
    l.primaryChannel = channel;
    change = true;
  }
  l.contactable = Boolean(channel);
  return { lead: l, change };
}

export function municipalityWords(municipality: Municipality): Set<string> {
  return new Set(normalizeCompanyName(municipality.name).split(' ').filter((p) => p.length > 2));
}

/** "source|street number" pairs that appear more than once in a batch (shopping malls). */
export function repeatedAddressesIn(candidates: Candidate[]): Set<string> {
  const count = new Map<string, number>();
  for (const c of candidates) {
    const plate = normalizeAddress(c.address);
    if (!plate) continue;
    const k = `${c.source}|${plate}`;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  return new Set([...count].filter(([, n]) => n > 1).map(([k]) => k));
}

/** What is kept from the original record in `occurrences.data`. */
export function dataToSave(c: Candidate): unknown {
  return c.raw ?? null;
}
