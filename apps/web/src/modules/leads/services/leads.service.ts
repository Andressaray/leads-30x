import { http, requestBlob } from "@/shared/lib/http";
import { descargarBlob } from "@/shared/lib/download";
import type { FiltrosLeads, ListadoLeads } from "../types";

export const LIMITE_TABLA = 20;

export function listarLeads(filtros: FiltrosLeads, pagina: number, signal?: AbortSignal): Promise<ListadoLeads> {
  return http.get<ListadoLeads>("/api/leads", { ...filtros, pagina, limite: LIMITE_TABLA }, signal);
}

export async function descargarCsvBusqueda(busquedaId: number): Promise<void> {
  const blob = await requestBlob("/api/leads/export.csv", { query: { busqueda: busquedaId } });
  descargarBlob(blob, `leads-busqueda-${busquedaId}.csv`);
}
