import { useSyncExternalStore } from "react";
import { FICHAS_FUENTES } from "./fichas";
import { fuentesStore } from "./store/fuentes-store";

/** Estado de los interruptores de "Fuentes" y la lista de las que están activas. */
export function useFuentes() {
  const estado = useSyncExternalStore(fuentesStore.subscribe, fuentesStore.get, fuentesStore.getServer);
  const activas = FICHAS_FUENTES.filter((f) => estado[f.clave]);
  return { estado, activas };
}

/** "A, B y C" */
export const listaNombres = (nombres: string[]) =>
  nombres.length <= 1 ? (nombres[0] ?? "") : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
