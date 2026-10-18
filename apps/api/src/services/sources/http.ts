// fetch with timeout, size limit and typed errors for the external sources.

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class SourceError extends Error {
  status?: number;
  retryable: boolean;
  retryAfterMs?: number;

  constructor(message: string, options: { status?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = 'SourceError';
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readWithLimit(response: Response, maxBytes: number): Promise<string> {
  const long = Number(response.headers.get('content-length'));
  if (long && long > maxBytes) throw new SourceError(`Respuesta demasiado grande (${Math.round(long / 1e6)} MB).`);
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new SourceError(`Respuesta demasiado grande (más de ${Math.round(maxBytes / 1e6)} MB). Filtra por categoría.`);
    }
    parts.push(value);
  }
  return Buffer.concat(parts.map((p) => Buffer.from(p))).toString('utf8');
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  fetchImpl?: FetchLike;
}

export async function requestJson<T = unknown>(url: string, o: RequestOptions = {}): Promise<T> {
  const { method = 'GET', headers = {}, body, timeoutMs = 60000, maxBytes = 50e6, fetchImpl = fetch } = o;
  let response: Response;
  try {
    response = await fetchImpl(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const e = err as Error;
    const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    throw new SourceError(timeout ? `Tiempo de espera agotado (${timeoutMs / 1000} s)` : `Sin conexión: ${e?.message}`, {
      retryable: true,
    });
  }
  if (!response.ok) {
    const error = new SourceError(`HTTP ${response.status}`, {
      status: response.status,
      retryable: response.status === 429 || response.status >= 500,
    });
    const retryAfter = Number(response.headers.get('retry-after'));
    if (Number.isFinite(retryAfter) && retryAfter > 0) error.retryAfterMs = retryAfter * 1000;
    throw error;
  }
  const text = await readWithLimit(response, maxBytes);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SourceError('La fuente no devolvió JSON válido.');
  }
}
