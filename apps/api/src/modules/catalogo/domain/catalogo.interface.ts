import type { CategoriaDTO, DepartamentoDTO, FiltroMunicipiosDTO, FuenteInfoDTO, MunicipioDTO } from '../types/catalogo.types';

export interface CatalogoDomainInterface {
  /** Categorías de negocio y a qué equivalen en cada fuente. */
  categorias(): Promise<CategoriaDTO[]>;
  /** Departamentos de Colombia (DIVIPOLA), ordenados por nombre. */
  departamentos(): Promise<DepartamentoDTO[]>;
  /** Municipios de la DIVIPOLA que coinciden con el texto. */
  municipios(filtro: FiltroMunicipiosDTO): Promise<MunicipioDTO[]>;
  /** Fuentes disponibles y qué datos de contacto trae cada una. */
  fuentes(): Promise<FuenteInfoDTO[]>;
}
