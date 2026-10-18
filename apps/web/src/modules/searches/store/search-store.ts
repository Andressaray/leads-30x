// "Search leads" state outside the component: the form, the result and the page of the
// table survive changing sections (the page unmounts, the store does not). A search in
// progress keeps polling its status even if you go to Contacted.
// It is also stored in sessionStorage (per user) so it survives a tab reload.
import { ApiError, errorMessage } from "@/shared/lib/http";
import { sessionStore } from "@/shared/lib/session-store";
import { createSearch } from "../services/searches.service";
import type { MunicipalityCandidate, CreateSearch, SearchResult } from "../types";

export interface SearchFormValues {
  department: string;
  code: string;
  category: string;
}

export type SearchStatus =
  | { status: "inactiva" }
  | { status: "searching" }
  | { status: "list"; result: SearchResult }
  | { status: "error"; title: string; details: string[] };

export interface SearchSnapshot {
  form: SearchFormValues;
  search: SearchStatus;
  /** Page of the result's leads table. */
  page: number;
}

const KEY = "leads_search";
const EMPTY: SearchSnapshot = {
  form: { department: "", code: "", category: "" },
  search: { status: "inactiva" },
  page: 1,
};

const listeners = new Set<() => void>();
let current: SearchSnapshot = EMPTY;
/** Storage key of the user `current` belongs to (undefined = not read yet). */
let currentOf: string | null | undefined;
let control: AbortController | null = null;

const userKey = () => {
  const s = sessionStore.get();
  return s ? `${KEY}:${s.user.id}` : null;
};

function load(key: string | null): SearchSnapshot {
  if (!key) return EMPTY;
  try {
    const raw = globalThis.sessionStorage?.getItem(key);
    if (!raw) return EMPTY;
    const v = JSON.parse(raw) as SearchSnapshot;
    if (!v?.form || !v.search) return EMPTY;
    // If the tab was reloaded in the middle of a search, nobody is polling it anymore.
    return v.search.status === "searching" ? { ...v, search: { status: "inactiva" } } : v;
  } catch {
    return EMPTY;
  }
}

function get(): SearchSnapshot {
  const key = userKey();
  if (key !== currentOf) {
    currentOf = key;
    current = load(key);
  }
  return current;
}

function set(changes: Partial<SearchSnapshot>) {
  get();
  current = { ...current, ...changes };
  try {
    if (currentOf) globalThis.sessionStorage?.setItem(currentOf, JSON.stringify(current));
  } catch {
    // sin persistencia: queda en memoria mientras la pestaña siga abierta
  }
  listeners.forEach((fn) => fn());
}

// Logging out discards everything (and stops the search in progress, if any).
sessionStore.subscribe(() => {
  if (sessionStore.get()) return;
  control?.abort();
  control = null;
  try {
    if (currentOf) globalThis.sessionStorage?.removeItem(currentOf);
  } catch {
    // nada que limpiar
  }
  current = EMPTY;
  currentOf = null;
  listeners.forEach((fn) => fn());
});

function isSourcesFailure(err: unknown): err is ApiError & { details: { bySource: Record<string, { error?: string | null }> } } {
  return err instanceof ApiError && err.status === 502 && typeof (err.details as { bySource?: unknown } | undefined)?.bySource === "object";
}

function isAmbiguous(err: unknown): err is ApiError & { details: { candidates: MunicipalityCandidate[] } } {
  return (
    err instanceof ApiError &&
    err.status === 409 &&
    Array.isArray((err.details as { candidates?: unknown } | undefined)?.candidates)
  );
}

async function runSearch(data: CreateSearch) {
  // A new search stops polling the status of the previous one.
  control?.abort();
  const own = new AbortController();
  control = own;
  set({ search: { status: "searching" }, page: 1 });
  try {
    const result = await createSearch(data, own.signal);
    if (!own.signal.aborted) set({ search: { status: "list", result } });
  } catch (err) {
    if (own.signal.aborted) return;
    if (isSourcesFailure(err)) {
      set({
        search: {
          status: "error",
          title: err.message,
          details: Object.entries(err.details.bySource)
            .filter(([, f]) => f?.error)
            .map(([n, f]) => `${n.toUpperCase()}: ${f.error}`),
        },
      });
    } else if (isAmbiguous(err)) {
      set({
        search: {
          status: "error",
          title: err.message,
          details: err.details.candidates.map((c) => `${c.name} (${c.department})`),
        },
      });
    } else {
      set({ search: { status: "error", title: "No se pudo completar la búsqueda.", details: [errorMessage(err)] } });
    }
  } finally {
    if (control === own) control = null;
  }
}

export const searchStore = {
  get,
  getServer: () => EMPTY,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  runSearch,
  setForm: (changes: Partial<SearchFormValues>) => set({ form: { ...get().form, ...changes } }),
  setPage: (page: number) => set({ page }),
};
