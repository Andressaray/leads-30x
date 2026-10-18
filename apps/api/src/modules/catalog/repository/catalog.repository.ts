// Static catalog data (categories, municipalities and sources). There is no database
// behind it: the "data layer" is the configuration files.

import { CATEGORIES, type CategoryDefinition } from '~config/catalog/categories';
import { searchMunicipalities, DEPARTMENTS } from '~utils/divipola';
import type { DepartmentDTO, SourceInfoDTO, MunicipalityFilterDTO, MunicipalityDTO } from '../types/catalog.types';

const SOURCES_INFO: SourceInfoDTO[] = [
  { name: 'dane', description: 'DANE – Registro Estadístico de Empresas (personas jurídicas activas)', contact: 'NIT, dirección, CIIU, coordenadas; sin teléfono ni correo', link: 'https://geoportal.dane.gov.co/geovisores/economia/directorio-estadistico-de-empresas/' },
  { name: 'osm', description: 'OpenStreetMap (Overpass API)', contact: 'Nombre comercial, coordenadas y a veces teléfono, web, correo y redes', link: 'https://www.openstreetmap.org/copyright' },
  { name: 'rnt', description: 'Registro Nacional de Turismo (datos.gov.co thwd-ivmp)', contact: 'NIT, dirección, celular, teléfono y correo', link: 'https://www.datos.gov.co/d/thwd-ivmp' },
  { name: 'secop', description: 'SECOP II – Proveedores Registrados (datos.gov.co qmzu-gj57)', contact: 'NIT, teléfono, correo y sitio web', link: 'https://www.datos.gov.co/d/qmzu-gj57' },
  { name: 'reps', description: 'REPS – Prestadores y sedes de salud (datos.gov.co c36g-9fc2)', contact: 'NIT, dirección, teléfono y correo por sede', link: 'https://www.datos.gov.co/d/c36g-9fc2' },
];

export async function findCategories(): Promise<[string, CategoryDefinition][]> {
  return Object.entries(CATEGORIES);
}

export async function findDepartments(): Promise<DepartmentDTO[]> {
  return Object.entries(DEPARTMENTS)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function findMunicipalities(f: MunicipalityFilterDTO): Promise<MunicipalityDTO[]> {
  return searchMunicipalities(f.q, f.departmentCode, f.limit);
}

export async function findSources(): Promise<SourceInfoDTO[]> {
  return SOURCES_INFO;
}
