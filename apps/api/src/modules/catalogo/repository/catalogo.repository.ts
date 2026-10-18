// Datos estáticos del catálogo (categorías, municipios y fuentes). No hay base
// de datos detrás: la "capa de datos" son los archivos de configuración.

import { CATEGORIAS, type DefinicionCategoria } from '~config/catalogo/categorias';
import { buscarMunicipios, DEPARTAMENTOS } from '~utils/divipola';
import type { DepartamentoDTO, FuenteInfoDTO, FiltroMunicipiosDTO, MunicipioDTO } from '../types/catalogo.types';

const FUENTES_INFO: FuenteInfoDTO[] = [
  { nombre: 'dane', descripcion: 'DANE – Registro Estadístico de Empresas (personas jurídicas activas)', contacto: 'NIT, dirección, CIIU, coordenadas; sin teléfono ni correo', enlace: 'https://geoportal.dane.gov.co/geovisores/economia/directorio-estadistico-de-empresas/' },
  { nombre: 'osm', descripcion: 'OpenStreetMap (Overpass API)', contacto: 'Nombre comercial, coordenadas y a veces teléfono, web, correo y redes', enlace: 'https://www.openstreetmap.org/copyright' },
  { nombre: 'rnt', descripcion: 'Registro Nacional de Turismo (datos.gov.co thwd-ivmp)', contacto: 'NIT, dirección, celular, teléfono y correo', enlace: 'https://www.datos.gov.co/d/thwd-ivmp' },
  { nombre: 'secop', descripcion: 'SECOP II – Proveedores Registrados (datos.gov.co qmzu-gj57)', contacto: 'NIT, teléfono, correo y sitio web', enlace: 'https://www.datos.gov.co/d/qmzu-gj57' },
  { nombre: 'reps', descripcion: 'REPS – Prestadores y sedes de salud (datos.gov.co c36g-9fc2)', contacto: 'NIT, dirección, teléfono y correo por sede', enlace: 'https://www.datos.gov.co/d/c36g-9fc2' },
];

export async function findCategorias(): Promise<[string, DefinicionCategoria][]> {
  return Object.entries(CATEGORIAS);
}

export async function findDepartamentos(): Promise<DepartamentoDTO[]> {
  return Object.entries(DEPARTAMENTOS)
    .map(([codigo, nombre]) => ({ codigo, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function findMunicipios(f: FiltroMunicipiosDTO): Promise<MunicipioDTO[]> {
  return buscarMunicipios(f.q, f.codDpto, f.limite);
}

export async function findFuentes(): Promise<FuenteInfoDTO[]> {
  return FUENTES_INFO;
}
