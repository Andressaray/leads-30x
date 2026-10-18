import { useSyncExternalStore } from "react";
import { busquedaStore } from "../store/busqueda-store";

export type { EstadoBusqueda, FormBusqueda } from "../store/busqueda-store";

/** Formulario, resultado y página de "Buscar leads". Se conservan al cambiar de sección. */
export function useBusqueda() {
  const { form, busqueda, pagina } = useSyncExternalStore(busquedaStore.subscribe, busquedaStore.get, busquedaStore.getServer);
  return {
    form,
    busqueda,
    pagina,
    buscar: busquedaStore.buscar,
    setForm: busquedaStore.setForm,
    setPagina: busquedaStore.setPagina,
  };
}
