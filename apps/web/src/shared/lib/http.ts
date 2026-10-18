// Cliente del backend (apps/api). La URL base sale de VITE_API_URL; vacía = mismo origen.
// Todas las respuestas de la API usan el sobre { status, data } o { status, error, details }.
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

function encabezados(extra?: Record<string, string>): Record<string, string> {
  const token = sessionStore.get()?.token;
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

interface Opciones {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

async function enviar(path: string, { method = "GET", query, body, signal }: Opciones): Promise<Response> {
  const conToken = Boolean(sessionStore.get());
  const res = await fetch(apiUrl(path, query), {
    method,
    signal,
    headers: encabezados(body !== undefined ? { "Content-Type": "application/json" } : undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  // La sesión venció o ya no es válida: se cierra y las rutas protegidas mandan al login.
  if (res.status === 401 && conToken) sessionStore.clear();
  return res;
}

/** Llama a la API y devuelve `data`; si la respuesta no es 2xx lanza ApiError con `error` y `details`. */
export async function request<T>(path: string, opciones: Opciones = {}): Promise<T> {
  const res = await enviar(path, opciones);
  const json = (await res.json().catch(() => null)) as { data?: T; error?: string; details?: unknown } | null;
  if (!res.ok) throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.details);
  return json?.data as T;
}

/** Para descargas (CSV, archivos): devuelve el cuerpo como Blob. */
export async function requestBlob(path: string, opciones: Opciones = {}): Promise<Blob> {
  const res = await enviar(path, opciones);
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

export function mensajeDeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
