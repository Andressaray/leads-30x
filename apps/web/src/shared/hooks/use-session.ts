import { useSyncExternalStore } from "react";
import { sessionStore, type Sesion } from "@/shared/lib/session-store";

/** Sesión actual (se re-renderiza al iniciar o cerrar sesión). null si no hay. */
export function useSesion(): Sesion | null {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, () => null);
}
