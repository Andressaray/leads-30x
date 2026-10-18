import * as realRepository from '../repository/catalog.repository';
import type { SourceName } from '~types/source.types';
import type { CatalogDomainInterface } from './catalog.interface';
import type { CategoryDTO, DepartmentDTO, MunicipalityFilterDTO, SourceInfoDTO, MunicipalityDTO } from '../types/catalog.types';

export class CatalogDomain implements CatalogDomainInterface {
  constructor(private readonly repo: typeof realRepository = realRepository) {}

  async categories(): Promise<CategoryDTO[]> {
    const list = await this.repo.findCategories();
    return list.map(([key, c]) => {
      const sources: SourceName[] = ['dane', 'osm'];
      if (c.rnt?.length) sources.push('rnt');
      if (c.reps) sources.push('reps');
      if (c.secop?.length) sources.push('secop');
      return { key, name: c.name, osm: c.osm, ciiu: c.ciiu, rnt: c.rnt ?? [], secop: c.secop ?? [], reps: Boolean(c.reps), sources };
    });
  }

  async departments(): Promise<DepartmentDTO[]> {
    return this.repo.findDepartments();
  }

  async municipalities(filter: MunicipalityFilterDTO): Promise<MunicipalityDTO[]> {
    return this.repo.findMunicipalities(filter);
  }

  async sources(): Promise<SourceInfoDTO[]> {
    return this.repo.findSources();
  }
}
