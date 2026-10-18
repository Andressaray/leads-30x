import { useSyncExternalStore } from "react";
import { sessionStore, type Session } from "@/shared/lib/session-store";

/** Current session (re-renders on login or logout). null if there is none. */
export function useSession(): Session | null {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, () => null);
}
