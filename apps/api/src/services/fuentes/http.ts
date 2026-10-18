// fetch con timeout, límite de tamaño y errores tipados para las fuentes externas.

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class ErrorFuente extends Error {
  status?: number;
  reintentable: boolean;
  retryAfterMs?: number;

  constructor(mensaje: string, opciones: { status?: number; reintentable?: boolean } = {}) {
    super(mensaje);
    this.name = 'ErrorFuente';
    this.status = opciones.status;
    this.reintentable = opciones.reintentable ?? false;
  }
}

export const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function leerConLimite(respuesta: Response, maxBytes: number): Promise<string> {
  const largo = Number(respuesta.headers.get('content-length'));
  if (largo && largo > maxBytes) throw new ErrorFuente(`Respuesta demasiado grande (${Math.round(largo / 1e6)} MB).`);
  if (!respuesta.body) return respuesta.text();
  const lector = respuesta.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await lector.cancel();
      throw new ErrorFuente(`Respuesta demasiado grande (más de ${Math.round(maxBytes / 1e6)} MB). Filtra por categoría.`);
    }
    partes.push(value);
  }
  return Buffer.concat(partes.map((p) => Buffer.from(p))).toString('utf8');
}

export interface OpcionesPedido {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  fetchImpl?: FetchLike;
}

export async function pedirJson<T = unknown>(url: string, o: OpcionesPedido = {}): Promise<T> {
  const { method = 'GET', headers = {}, body, timeoutMs = 60000, maxBytes = 50e6, fetchImpl = fetch } = o;
  let respuesta: Response;
  try {
    respuesta = await fetchImpl(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const e = err as Error;
    const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    throw new ErrorFuente(timeout ? `Tiempo de espera agotado (${timeoutMs / 1000} s)` : `Sin conexión: ${e?.message}`, {
      reintentable: true,
    });
  }
  if (!respuesta.ok) {
    const error = new ErrorFuente(`HTTP ${respuesta.status}`, {
      status: respuesta.status,
      reintentable: respuesta.status === 429 || respuesta.status >= 500,
    });
    const retryAfter = Number(respuesta.headers.get('retry-after'));
    if (Number.isFinite(retryAfter) && retryAfter > 0) error.retryAfterMs = retryAfter * 1000;
    throw error;
  }
  const texto = await leerConLimite(respuesta, maxBytes);
  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new ErrorFuente('La fuente no devolvió JSON válido.');
  }
}
