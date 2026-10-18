import type { Municipio, NombreFuente } from '~types/fuente.types';

export interface CategoriaDTO {
  clave: string;
  nombre: string;
  osm: string[];
  ciiu: string[];
  rnt: string[];
  secop: string[];
  reps: boolean;
  fuentes: NombreFuente[];
}

export interface FuenteInfoDTO {
  nombre: NombreFuente;
  descripcion: string;
  contacto: string;
  enlace: string;
}

export interface FiltroMunicipiosDTO {
  q: string;
  codDpto: string | null;
  limite: number;
}

export type MunicipioDTO = Municipio;

export interface DepartamentoDTO {
  codigo: string;
  nombre: string;
}
