import { useSyncExternalStore } from "react";
import { SOURCE_CARDS } from "./cards";
import { sourcesStore } from "./store/sources-store";

/** State of the "Fuentes" toggles and the list of the active ones. */
export function useSources() {
  const status = useSyncExternalStore(sourcesStore.subscribe, sourcesStore.get, sourcesStore.getServer);
  const active = SOURCE_CARDS.filter((f) => status[f.key]);
  return { status, active };
}

/** "A, B y C" */
export const namesList = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
