// Client for the datos.gov.co datasets (Socrata platform, SoQL API).
// Pages with $limit/$offset and stops at a maximum number of records per query.

import { requestJson, SourceError, type FetchLike } from './http';

export const DATOS_GOV_BASE = 'https://www.datos.gov.co/resource';

export interface SocrataOptions {
  appToken?: string;
  timeoutMs?: number;
  maxRecords?: number;
  userAgent?: string;
  fetchImpl?: FetchLike;
  base?: string;
}

/** Escapes a text literal for SoQL ('...'). */
export function literalSoql(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function createSocrataClient(o: SocrataOptions = {}) {
  const base = o.base ?? DATOS_GOV_BASE;
  const page = 5000;
  const maximum = o.maxRecords ?? 20000;

  return async function query<T = Record<string, string>>(
    dataset: string,
    query: { $where?: string; $select?: string; $order?: string }
  ): Promise<{ rows: T[]; truncated: boolean }> {
    if (!/^[a-z0-9]{4}-[a-z0-9]{4}$/.test(dataset)) throw new SourceError(`Dataset inválido: ${dataset}`);
    const rows: T[] = [];
    for (let offset = 0; offset < maximum; offset += page) {
      const size = Math.min(page, maximum - offset);
      const params = new URLSearchParams({ ...query, $limit: String(size), $offset: String(offset) });
      if (!params.has('$order')) params.set('$order', ':id');
      const batch = await requestJson<T[]>(`${base}/${dataset}.json?${params}`, {
        timeoutMs: o.timeoutMs,
        fetchImpl: o.fetchImpl,
        headers: {
          Accept: 'application/json',
          ...(o.appToken ? { 'X-App-Token': o.appToken } : {}),
          ...(o.userAgent ? { 'User-Agent': o.userAgent } : {}),
        },
      });
      if (!Array.isArray(batch)) throw new SourceError('datos.gov.co respondió en un formato inesperado.');
      rows.push(...batch);
      if (batch.length < size) return { rows, truncated: false };
    }
    return { rows, truncated: true };
  };
}

export type QuerySocrata = ReturnType<typeof createSocrataClient>;
