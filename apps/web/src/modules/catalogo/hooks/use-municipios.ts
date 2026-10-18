import { useEffect, useState } from "react";
import { getMunicipios } from "../services/catalogo.service";
import type { Municipio } from "../types";

export type EstadoMunicipios =
  | { estado: "sin-departamento" }
  | { estado: "cargando" }
  | { estado: "error" }
  | { estado: "listo"; municipios: Municipio[] };

type Respuesta = { departamento: string; municipios: Municipio[] | null };

/** Municipios del departamento elegido; se recargan cada vez que cambia. */
export function useMunicipios(codDepartamento: string): EstadoMunicipios {
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);

  useEffect(() => {
    if (!codDepartamento) return;
    const control = new AbortController();
    getMunicipios(codDepartamento, control.signal)
      .then((municipios) => setRespuesta({ departamento: codDepartamento, municipios }))
      .catch(() => {
        if (!control.signal.aborted) setRespuesta({ departamento: codDepartamento, municipios: null });
      });
    return () => control.abort();
  }, [codDepartamento]);

  if (!codDepartamento) return { estado: "sin-departamento" };
  if (respuesta?.departamento !== codDepartamento) return { estado: "cargando" };
  return respuesta.municipios ? { estado: "listo", municipios: respuesta.municipios } : { estado: "error" };
}
