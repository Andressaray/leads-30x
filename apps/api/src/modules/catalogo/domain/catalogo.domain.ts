import * as repositorioReal from '../repository/catalogo.repository';
import type { NombreFuente } from '~types/fuente.types';
import type { CatalogoDomainInterface } from './catalogo.interface';
import type { CategoriaDTO, DepartamentoDTO, FiltroMunicipiosDTO, FuenteInfoDTO, MunicipioDTO } from '../types/catalogo.types';

export class CatalogoDomain implements CatalogoDomainInterface {
  constructor(private readonly repo: typeof repositorioReal = repositorioReal) {}

  async categorias(): Promise<CategoriaDTO[]> {
    const lista = await this.repo.findCategorias();
    return lista.map(([clave, c]) => {
      const fuentes: NombreFuente[] = ['dane', 'osm'];
      if (c.rnt?.length) fuentes.push('rnt');
      if (c.reps) fuentes.push('reps');
      if (c.secop?.length) fuentes.push('secop');
      return { clave, nombre: c.nombre, osm: c.osm, ciiu: c.ciiu, rnt: c.rnt ?? [], secop: c.secop ?? [], reps: Boolean(c.reps), fuentes };
    });
  }

  async departamentos(): Promise<DepartamentoDTO[]> {
    return this.repo.findDepartamentos();
  }

  async municipios(filtro: FiltroMunicipiosDTO): Promise<MunicipioDTO[]> {
    return this.repo.findMunicipios(filtro);
  }

  async fuentes(): Promise<FuenteInfoDTO[]> {
    return this.repo.findFuentes();
  }
}
