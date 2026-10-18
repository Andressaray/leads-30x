import { useCallback, useEffect, useState } from "react";
import { mensajeDeError } from "@/shared/lib/http";
import { listarPlantillas, obtenerFicha } from "../services/contacto.service";
import type { FichaContacto, Plantilla } from "../types";

type Estado = { estado: "cargando" } | { estado: "error"; mensaje: string } | { estado: "listo"; ficha: FichaContacto };

/** Ficha de contacto de un lead (estado, historial, permisos) y las plantillas activas. */
export function useFicha(leadId: number) {
  const [estado, setEstado] = useState<Estado>({ estado: "cargando" });
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const control = new AbortController();
    obtenerFicha(leadId, control.signal)
      .then((ficha) => setEstado({ estado: "listo", ficha }))
      .catch((err: unknown) => !control.signal.aborted && setEstado({ estado: "error", mensaje: mensajeDeError(err) }));
    return () => control.abort();
  }, [leadId, version]);

  useEffect(() => {
    listarPlantillas().then(setPlantillas, () => setPlantillas([]));
  }, []);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { ...estado, plantillas, recargar } as Estado & { plantillas: Plantilla[]; recargar: () => void };
}
