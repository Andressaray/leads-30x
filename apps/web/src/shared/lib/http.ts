// Backend client (apps/api). The base URL comes from VITE_API_URL; empty = same origin.
// Every API response uses the { status, data } or { status, error, details } envelope.
import { sessionStore } from "./session-store";

const BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export type Query = Record<string, string | number | boolean | null | undefined>;

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function apiUrl(path: string, query?: Query): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return `${BASE_URL}${path}${s ? `?${s}` : ""}`;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  const token = sessionStore.get()?.token;
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

interface Options {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

async function send(path: string, { method = "GET", query, body, signal }: Options): Promise<Response> {
  const withToken = Boolean(sessionStore.get());
  const res = await fetch(apiUrl(path, query), {
    method,
    signal,
    headers: headers(body !== undefined ? { "Content-Type": "application/json" } : undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  // The session expired or is no longer valid: it is closed and the protected routes send you to login.
  if (res.status === 401 && withToken) sessionStore.clear();
  return res;
}

/** Calls the API and returns `data`; if the response is not 2xx it throws ApiError with `error` and `details`. */
export async function request<T>(path: string, options: Options = {}): Promise<T> {
  const res = await send(path, options);
  const json = (await res.json().catch(() => null)) as { data?: T; error?: string; details?: unknown } | null;
  if (!res.ok) throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.details);
  return json?.data as T;
}

/** For downloads (CSV, files): returns the body as a Blob. */
export async function requestBlob(path: string, options: Options = {}): Promise<Blob> {
  const res = await send(path, options);
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`);
  }
  return res.blob();
}

export const http = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
