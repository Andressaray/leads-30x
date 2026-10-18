import { vi } from "vitest";

/** Response with the API envelope: { status, data } if 2xx, { status, error, details } otherwise. */
export function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const ok = <T>(data: T, status = 200) => response(status, { status: "success", data });
export const failure = (status: number, error: string, details?: unknown) => response(status, { status: "error", error, details });

export type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

/**
 * Replaces fetch with a mock. Routes are looked up by "METHOD /route" (without query) and, if not found,
 * by "/route". A route without a handler responds 404 so the test fails with a clear message.
 */
export function mockFetch(routes: Record<string, Handler | Response> = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "http://localhost");
    const method = (init.method ?? "GET").toUpperCase();
    const m = routes[`${method} ${url.pathname}`] ?? routes[url.pathname];
    if (!m) return failure(404, `Sin mock para ${method} ${url.pathname}`);
    return typeof m === "function" ? m(url, init) : m.clone();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** URL and options of fetch call number `i`. */
export function call(fetchMock: ReturnType<typeof mockFetch>, i = 0) {
  const [input, init = {}] = fetchMock.mock.calls[i] as [string, RequestInit | undefined];
  const url = new URL(input, "http://localhost");
  const headers = (init.headers ?? {}) as Record<string, string>;
  return { url, init, headers, body: init.body ? JSON.parse(String(init.body)) : undefined };
}
