import { http, request } from "@/shared/lib/http";
import type { Cost, Metrics, NewCost } from "../types";

export const getMetrics = (from: string, to: string, signal?: AbortSignal) =>
  http.get<Metrics>("/api/metrics", { from, to }, signal);

export const listCosts = (from: string, to: string) => http.get<Cost[]>("/api/costs", { from, to });
export const createCost = (c: NewCost) => http.post<Cost>("/api/costs", c);
export const deleteCost = (id: number) => request<{ id: number }>(`/api/costs/${id}`, { method: "DELETE" });
