import type { Municipality, SourceName } from '~types/source.types';

export interface CategoryDTO {
  key: string;
  name: string;
  osm: string[];
  ciiu: string[];
  rnt: string[];
  secop: string[];
  reps: boolean;
  sources: SourceName[];
}

export interface SourceInfoDTO {
  name: SourceName;
  description: string;
  contact: string;
  link: string;
}

export interface MunicipalityFilterDTO {
  q: string;
  departmentCode: string | null;
  limit: number;
}

export type MunicipalityDTO = Municipality;

export interface DepartmentDTO {
  code: string;
  name: string;
}
