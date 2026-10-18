import { http } from "@/shared/lib/http";
import type { Categoria, Departamento, Municipio } from "../types";

// Los catálogos casi no cambian: se guardan en memoria para que ir y volver a "Buscar leads"
// no espere a la red. Solo se guardan respuestas buenas (un error se reintenta la próxima vez).
const cache = new Map<string, unknown>();

async function enCache<T>(clave: string, cargar: () => Promise<T>): Promise<T> {
  if (cache.has(clave)) return cache.get(clave) as T;
  const valor = await cargar();
  cache.set(clave, valor);
  return valor;
}

export const getCategorias = () => enCache("categorias", () => http.get<Categoria[]>("/api/catalogo/categorias"));

export const getDepartamentos = () => enCache("departamentos", () => http.get<Departamento[]>("/api/catalogo/departamentos"));

export function getMunicipios(codDepartamento: string, signal?: AbortSignal): Promise<Municipio[]> {
  return enCache(`municipios:${codDepartamento}`, () => cargarMunicipios(codDepartamento, signal));
}

async function cargarMunicipios(codDepartamento: string, signal?: AbortSignal): Promise<Municipio[]> {
  const municipios = await http.get<Municipio[]>(
    "/api/catalogo/municipios",
    { departamento: codDepartamento, limite: 1200 },
    signal,
  );
  return [...municipios].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
