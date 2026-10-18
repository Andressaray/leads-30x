// Card of the built-in sources (the ones coded in services/sources).
// The name and description always come from here; the database only stores whether
// they are active. The sources added by the team live in the "sources" table.

import type { BuiltInSource } from '~types/source.types';

export interface SourceCard {
  key: BuiltInSource;
  name: string;
  description: string;
  /** What contact data it provides. */
  contact: string;
  link: string;
}

export const BUILT_IN_CARDS: readonly SourceCard[] = [
  {
    key: 'dane',
    name: 'DANE',
    description: 'DANE – Registro Estadístico de Empresas (personas jurídicas activas)',
    contact: 'NIT, dirección, CIIU, coordenadas; sin teléfono ni correo',
    link: 'https://geoportal.dane.gov.co/geovisores/economia/directorio-estadistico-de-empresas/',
  },
  {
    key: 'osm',
    name: 'OpenStreetMap',
    description: 'OpenStreetMap (Overpass API)',
    contact: 'Nombre comercial, coordenadas y a veces teléfono, web, correo y redes',
    link: 'https://www.openstreetmap.org/copyright',
  },
  {
    key: 'rnt',
    name: 'Registro Nacional de Turismo',
    description: 'Registro Nacional de Turismo (datos.gov.co thwd-ivmp)',
    contact: 'NIT, dirección, celular, teléfono y correo',
    link: 'https://www.datos.gov.co/d/thwd-ivmp',
  },
  {
    key: 'secop',
    name: 'SECOP II',
    description: 'SECOP II – Proveedores Registrados (datos.gov.co qmzu-gj57)',
    contact: 'NIT, teléfono, correo y sitio web',
    link: 'https://www.datos.gov.co/d/qmzu-gj57',
  },
  {
    key: 'reps',
    name: 'REPS',
    description: 'REPS – Prestadores y sedes de salud (datos.gov.co c36g-9fc2)',
    contact: 'NIT, dirección, teléfono y correo por sede',
    link: 'https://www.datos.gov.co/d/c36g-9fc2',
  },
];
