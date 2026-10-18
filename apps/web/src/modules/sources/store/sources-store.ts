// Which sources are active. It lives only in the browser (localStorage): it is not queried
// nor sent to the API. If no storage is available, it stays in memory.
import type { SourceName } from "@/modules/leads";
import { SOURCE_CARDS } from "../cards";

export type SourcesState = Record<SourceName, boolean>;

const KEY = "leads_sources";
const ALL: SourcesState = Object.fromEntries(SOURCE_CARDS.map((f) => [f.key, true])) as SourcesState;

const listeners = new Set<() => void>();
let current: SourcesState | undefined;

function get(): SourcesState {
  if (current) return current;
  current = ALL;
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<SourcesState>) : {};
    current = { ...ALL };
    for (const f of SOURCE_CARDS) if (typeof saved[f.key] === "boolean") current[f.key] = saved[f.key]!;
  } catch {
    // sin persistencia: todas activas
  }
  return current;
}

function set(value: SourcesState) {
  current = value;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(value));
  } catch {
    // sin persistencia: queda en memoria mientras la pestaña siga abierta
  }
  listeners.forEach((fn) => fn());
}

export const sourcesStore = {
  get,
  getServer: () => ALL,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  toggle: (key: SourceName) => set({ ...get(), [key]: !get()[key] }),
  all: (active: boolean) => set(Object.fromEntries(SOURCE_CARDS.map((f) => [f.key, active])) as SourcesState),
};
