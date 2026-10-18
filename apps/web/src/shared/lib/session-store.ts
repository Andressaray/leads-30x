// User session (token + basic data). Stored in localStorage so login is not required
// on every reload; if it is not available (private mode, prerender) it stays only in memory.

export type Role = "SERVICE" | "ADMIN";

export interface SessionUser {
  id: number;
  email: string;
  fullName: string;
  role: Role;
}

export interface Session {
  token: string;
  user: SessionUser;
}

const KEY = "leads_session";
const listeners = new Set<() => void>();

let current: Session | null | undefined;

function isSession(v: unknown): v is Session {
  const s = v as Session | null;
  return Boolean(s && typeof s.token === "string" && s.user && typeof s.user.id === "number");
}

function read(): Session | null {
  if (current !== undefined) return current;
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    current = isSession(value) ? value : null;
  } catch {
    current = null;
  }
  return current;
}

function save(value: Session | null) {
  current = value;
  try {
    if (value) globalThis.localStorage?.setItem(KEY, JSON.stringify(value));
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    // sin persistencia: queda solo en memoria
  }
  listeners.forEach((fn) => fn());
}

export const sessionStore = {
  get: read,
  set: (value: Session) => save(value),
  clear: () => save(null),
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
