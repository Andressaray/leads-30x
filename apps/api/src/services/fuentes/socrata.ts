// Cliente para los datasets de datos.gov.co (plataforma Socrata, API SoQL).
// Pagina con $limit/$offset y corta en un máximo de registros por consulta.

import { pedirJson, ErrorFuente, type FetchLike } from './http';

export const DATOS_GOV_BASE = 'https://www.datos.gov.co/resource';

export interface OpcionesSocrata {
  appToken?: string;
  timeoutMs?: number;
  maxRegistros?: number;
  userAgent?: string;
  fetchImpl?: FetchLike;
  base?: string;
}

/** Escapa un literal de texto para SoQL ('...'). */
export function literalSoql(valor: string): string {
  return `'${String(valor).replace(/'/g, "''")}'`;
}

export function crearClienteSocrata(o: OpcionesSocrata = {}) {
  const base = o.base ?? DATOS_GOV_BASE;
  const pagina = 5000;
  const maximo = o.maxRegistros ?? 20000;

  return async function consultar<T = Record<string, string>>(
    dataset: string,
    consulta: { $where?: string; $select?: string; $order?: string }
  ): Promise<{ filas: T[]; truncado: boolean }> {
    if (!/^[a-z0-9]{4}-[a-z0-9]{4}$/.test(dataset)) throw new ErrorFuente(`Dataset inválido: ${dataset}`);
    const filas: T[] = [];
    for (let offset = 0; offset < maximo; offset += pagina) {
      const tamano = Math.min(pagina, maximo - offset);
      const params = new URLSearchParams({ ...consulta, $limit: String(tamano), $offset: String(offset) });
      if (!params.has('$order')) params.set('$order', ':id');
      const lote = await pedirJson<T[]>(`${base}/${dataset}.json?${params}`, {
        timeoutMs: o.timeoutMs,
        fetchImpl: o.fetchImpl,
        headers: {
          Accept: 'application/json',
          ...(o.appToken ? { 'X-App-Token': o.appToken } : {}),
          ...(o.userAgent ? { 'User-Agent': o.userAgent } : {}),
        },
      });
      if (!Array.isArray(lote)) throw new ErrorFuente('datos.gov.co respondió en un formato inesperado.');
      filas.push(...lote);
      if (lote.length < tamano) return { filas, truncado: false };
    }
    return { filas, truncado: true };
  };
}

export type ConsultarSocrata = ReturnType<typeof crearClienteSocrata>;
