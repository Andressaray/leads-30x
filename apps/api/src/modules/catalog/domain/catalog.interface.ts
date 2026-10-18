import type { CategoryDTO, DepartmentDTO, MunicipalityFilterDTO, SourceInfoDTO, MunicipalityDTO } from '../types/catalog.types';

export interface CatalogDomainInterface {
  /** Business categories and what they map to in each source. */
  categories(): Promise<CategoryDTO[]>;
  /** Departments of Colombia (DIVIPOLA), sorted by name. */
  departments(): Promise<DepartmentDTO[]>;
  /** DIVIPOLA municipalities that match the text. */
  municipalities(filter: MunicipalityFilterDTO): Promise<MunicipalityDTO[]>;
  /** Available sources and what contact data each one provides. */
  sources(): Promise<SourceInfoDTO[]>;
}
