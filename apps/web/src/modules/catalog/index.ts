// Public API of the catalog module (categories, departments and municipalities).
export { getCategories, getDepartments, getMunicipalities } from "./services/catalog.service";
export { useMunicipalities, type MunicipalitiesState } from "./hooks/use-municipalities";
export type { Category, Department, Municipality } from "./types";
