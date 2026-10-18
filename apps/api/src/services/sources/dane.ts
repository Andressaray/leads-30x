// DANE source – Registro Estadístico de Empresas.
// Uses the JSON service behind DANE's public geoviewer. It returns
// active legal entities with NIT, legal name, address, CIIU and
// coordinates. It does NOT include phone or email: those arrive when matching with other sources.
// The service builds its query from what it receives: only validated numeric codes are sent to it.

import type { Candidate, SourceFilter, LeadSource, Municipality } from '~types/source.types';
import { normalizeNit, normalizePhones, usefulValue } from '~utils/normalize';
import { SourceError, wait, requestJson, type FetchLike } from './http';

export const DEFAULT_DANE_URL =
  'https://geoportal.dane.gov.co/laboratorio/serviciosjson/directoriodeempresas/coordenadas1.php';

interface DaneRecord {
  NIT?: string;
  RAZON_SOCIAL?: string;
  NOMBRE_COMERCIAL?: string;
  DIRECCION?: string;
  MUNI_ID_DPTO?: string;
  MUNI_ID_MPIO?: string;
  TELEFONO1?: string;
  CIIU_ID_CIIU_4_V?: string;
  LATITUD?: string;
  LONGITUD?: string;
}

export function buildDaneUrl(base: string, municipalityCode: string, ciiu?: string): string {
  if (!/^\d{5}$/.test(municipalityCode)) throw new SourceError('Código de municipio inválido.');
  if (ciiu !== undefined && !/^\d{4}$/.test(ciiu)) throw new SourceError('Código CIIU inválido.');
  const url = new URL(base);
  url.searchParams.set('cod_dpto', municipalityCode.slice(0, 2));
  url.searchParams.set('cod_mpio', municipalityCode);
  if (ciiu) url.searchParams.set('ciiu', ciiu);
  return url.toString();
}

export function daneToCandidate(r: DaneRecord, municipality: Municipality): Candidate {
  const municipalityCode = `${r.MUNI_ID_DPTO ?? ''}${r.MUNI_ID_MPIO ?? ''}`.trim();
  const nit = normalizeNit(r.NIT);
  const lat = Number.parseFloat(r.LATITUD ?? '');
  const lon = Number.parseFloat(r.LONGITUD ?? '');
  const legalName = usefulValue(r.RAZON_SOCIAL);
  const tradeName = usefulValue(r.NOMBRE_COMERCIAL);
  const ciiu = usefulValue(r.CIIU_ID_CIIU_4_V);
  return {
    source: 'dane',
    externalId: nit ?? `${municipalityCode}:${legalName}`,
    name: tradeName ?? legalName,
    legalName,
    tradeName,
    nit,
    municipalityCode: /^\d{5}$/.test(municipalityCode) ? municipalityCode : municipality.code,
    address: usefulValue(r.DIRECCION),
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    ciiu,
    sourceCategory: ciiu ? `CIIU ${ciiu}` : null,
    phones: normalizePhones(r.TELEFONO1, municipality.departmentCode),
    emails: [],
    websites: [],
    socialLinks: [],
    isIndividual: false,
    raw: r,
  };
}

/** Runs `task` on each item with at most `limit` in flight at a time, keeping the order. */
async function inParallel<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await task(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}

export function createDaneSource(
  o: {
    url?: string;
    timeoutMs?: number;
    maxBytes?: number;
    userAgent?: string;
    /** How many CIIU codes are queried at once (the service is public: do not raise it much) */
    parallelQueries?: number;
    /** Pause before the only retry when DANE responds 5xx or the connection drops */
    retryPauseMs?: number;
    fetchImpl?: FetchLike;
  } = {}
): LeadSource {
  const base = o.url ?? DEFAULT_DANE_URL;
  const parallel = o.parallelQueries ?? 3;
  const pause = o.retryPauseMs ?? 1500;

  async function queryOnce(municipalityCode: string, ciiu?: string): Promise<DaneRecord[]> {
    const data = await requestJson<{ estado?: boolean; resultado?: DaneRecord[] }>(buildDaneUrl(base, municipalityCode, ciiu), {
      timeoutMs: o.timeoutMs ?? 60000,
      maxBytes: o.maxBytes ?? 60e6,
      fetchImpl: o.fetchImpl,
      headers: { Accept: 'application/json', ...(o.userAgent ? { 'User-Agent': o.userAgent } : {}) },
    });
    if (!data || data.estado !== true || !Array.isArray(data.resultado)) {
      throw new SourceError('El servicio del DANE respondió sin resultados válidos.');
    }
    return data.resultado;
  }

  async function query(municipalityCode: string, ciiu?: string): Promise<DaneRecord[]> {
    try {
      return await queryOnce(municipalityCode, ciiu);
    } catch (err) {
      const e = err as SourceError;
      // A DANE 500 is usually transient; a timeout is not: retrying it would double the wait.
      if (!e.retryable || e.message.startsWith('Tiempo de espera')) throw err;
      await wait(Math.min(e.retryAfterMs ?? pause, 10000));
      return queryOnce(municipalityCode, ciiu);
    }
  }

  return {
    name: 'dane',
    description: 'DANE – Registro Estadístico de Empresas (personas jurídicas activas; sin datos de contacto)',
    async search(municipality: Municipality, filter: SourceFilter) {
      const codes: (string | undefined)[] = filter.values.length ? filter.values : [undefined];
      const batches = await inParallel(codes, parallel, (ciiu) => query(municipality.code, ciiu));
      const seen = new Set<string>();
      const candidates: Candidate[] = [];
      for (const r of batches.flat()) {
        const c = daneToCandidate(r, municipality);
        if (seen.has(c.externalId)) continue;
        seen.add(c.externalId);
        candidates.push(c);
      }
      return { candidates, meta: { queries: codes.length } };
    },
  };
}
