import { vi } from "vitest";

/** Respuesta con el sobre de la API: { status, data } si es 2xx, { status, error, details } si no. */
export function respuesta(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });
}

export const ok = <T>(data: T, status = 200) => respuesta(status, { status: "success", data });
export const falla = (status: number, error: string, details?: unknown) => respuesta(status, { status: "error", error, details });

export type Manejador = (url: URL, init: RequestInit) => Response | Promise<Response>;

/**
 * Reemplaza fetch por un mock. Las rutas se buscan por "MÉTODO /ruta" (sin query) y, si no hay,
 * por "/ruta". Una ruta sin manejador responde 404 para que el test falle con un mensaje claro.
 */
export function mockFetch(rutas: Record<string, Manejador | Response> = {}) {
  const fetchMock = vi.fn(async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(entrada), "http://localhost");
    const metodo = (init.method ?? "GET").toUpperCase();
    const m = rutas[`${metodo} ${url.pathname}`] ?? rutas[url.pathname];
    if (!m) return falla(404, `Sin mock para ${metodo} ${url.pathname}`);
    return typeof m === "function" ? m(url, init) : m.clone();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** URL y opciones de la llamada número `i` a fetch. */
export function llamada(fetchMock: ReturnType<typeof mockFetch>, i = 0) {
  const [entrada, init = {}] = fetchMock.mock.calls[i] as [string, RequestInit | undefined];
  const url = new URL(entrada, "http://localhost");
  const headers = (init.headers ?? {}) as Record<string, string>;
  return { url, init, headers, body: init.body ? JSON.parse(String(init.body)) : undefined };
}
