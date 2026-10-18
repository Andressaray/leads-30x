import { http, request } from "@/shared/lib/http";
import type { Costo, Metricas, NuevoCosto } from "../types";

export const obtenerMetricas = (desde: string, hasta: string, signal?: AbortSignal) =>
  http.get<Metricas>("/api/metricas", { desde, hasta }, signal);

export const listarCostos = (desde: string, hasta: string) => http.get<Costo[]>("/api/costos", { desde, hasta });
export const crearCosto = (c: NuevoCosto) => http.post<Costo>("/api/costos", c);
export const eliminarCosto = (id: number) => request<{ id: number }>(`/api/costos/${id}`, { method: "DELETE" });
