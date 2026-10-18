// API pública del módulo catalogo (categorías, departamentos y municipios).
export { getCategorias, getDepartamentos, getMunicipios } from "./services/catalogo.service";
export { useMunicipios, type EstadoMunicipios } from "./hooks/use-municipios";
export type { Categoria, Departamento, Municipio } from "./types";
