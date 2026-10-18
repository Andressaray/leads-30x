import { useCallback, useEffect, useState } from "react";
import { mensajeDeError } from "@/shared/lib/http";
import { listarLeads } from "../services/leads.service";
import type { FiltrosLeads, ListadoLeads } from "../types";

interface Respuesta {
  clave: string;
  datos: ListadoLeads | null;
  error: string | null;
}

interface OpcionesPagina {
  /** Página controlada desde afuera (para conservarla al cambiar de sección). Sin valor, la maneja el hook. */
  pagina?: number;
  onCambiarPagina?: (pagina: number) => void;
}

/** Tabla paginada de leads para unos filtros; recargar() la vuelve a pedir (tras contactar un lead). */
export function useLeads(filtros: FiltrosLeads, { pagina: paginaExterna, onCambiarPagina }: OpcionesPagina = {}) {
  const claveFiltros = JSON.stringify(filtros);
  // La página se guarda junto a sus filtros: si cambian, se vuelve a la 1 sin un efecto extra.
  const [paginaDe, setPaginaDe] = useState({ filtros: claveFiltros, pagina: 1 });
  const paginaInterna = paginaDe.filtros === claveFiltros ? paginaDe.pagina : 1;
  const pagina = paginaExterna ?? paginaInterna;
  const [recarga, setRecarga] = useState(0);
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);

  const clave = `${claveFiltros}|${pagina}|${recarga}`;

  useEffect(() => {
    const control = new AbortController();
    listarLeads(JSON.parse(claveFiltros) as FiltrosLeads, pagina, control.signal)
      .then((datos) => setRespuesta({ clave, datos, error: null }))
      .catch((err: unknown) => {
        if (!control.signal.aborted) setRespuesta({ clave, datos: null, error: mensajeDeError(err) });
      });
    return () => control.abort();
  }, [clave, claveFiltros, pagina]);

  const setPagina = useCallback(
    (p: number) => (onCambiarPagina ? onCambiarPagina(p) : setPaginaDe({ filtros: claveFiltros, pagina: p })),
    [claveFiltros, onCambiarPagina],
  );

  const recargar = useCallback(() => setRecarga((n) => n + 1), []);

  const cargando = respuesta?.clave !== clave;
  return {
    cargando,
    // Mientras carga se conservan los datos anteriores (sirven para dimensionar el esqueleto).
    datos: respuesta?.datos ?? null,
    error: cargando ? null : (respuesta?.error ?? null),
    pagina,
    setPagina,
    recargar,
  };
}
