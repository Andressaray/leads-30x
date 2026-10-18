export interface Categoria {
  clave: string;
  nombre: string;
}

export interface Departamento {
  codigo: string;
  nombre: string;
}

export interface Municipio {
  codigo: string;
  nombre: string;
  departamento: string;
  codigoDepartamento: string;
}
