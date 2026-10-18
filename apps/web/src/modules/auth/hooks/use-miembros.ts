import { useEffect, useState } from "react";
import { mensajeDeError } from "@/shared/lib/http";
import { listarMiembros } from "../services/auth.service";
import type { Miembro } from "../types";

export type EstadoMiembros =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "listo"; miembros: Miembro[] };

/** Miembros del equipo (sin administradores). Se piden al montar, así los conteos salen al día. */
export function useMiembros(): EstadoMiembros {
  const [estado, setEstado] = useState<EstadoMiembros>({ estado: "cargando" });

  useEffect(() => {
    const control = new AbortController();
    listarMiembros(control.signal)
      .then((miembros) => setEstado({ estado: "listo", miembros }))
      .catch((err: unknown) => {
        if (!control.signal.aborted) setEstado({ estado: "error", mensaje: mensajeDeError(err) });
      });
    return () => control.abort();
  }, []);

  return estado;
}
