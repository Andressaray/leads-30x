import { http } from "@/shared/lib/http";
import type { Category, Department, Municipality } from "../types";

// Catalogs barely change: they are kept in memory so that going back and forth to "Search leads"
// does not wait for the network. Only good responses are kept (an error is retried the next time).
const cache = new Map<string, unknown>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (cache.has(key)) return cache.get(key) as T;
  const value = await load();
  cache.set(key, value);
  return value;
}

export const getCategories = () => cached("categories", () => http.get<Category[]>("/api/catalog/categories"));

export const getDepartments = () => cached("departments", () => http.get<Department[]>("/api/catalog/departments"));

export function getMunicipalities(departmentCode: string, signal?: AbortSignal): Promise<Municipality[]> {
  return cached(`municipios:${departmentCode}`, () => loadMunicipalities(departmentCode, signal));
}

async function loadMunicipalities(departmentCode: string, signal?: AbortSignal): Promise<Municipality[]> {
  const municipalities = await http.get<Municipality[]>(
    "/api/catalog/municipalities",
    { department: departmentCode, limit: 1200 },
    signal,
  );
  return [...municipalities].sort((a, b) => a.name.localeCompare(b.name, "es"));
}
