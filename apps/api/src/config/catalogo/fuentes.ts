// Ficha de las fuentes integradas (las que vienen programadas en services/fuentes).
// El nombre y la descripción salen siempre de aquí; la base de datos solo guarda si
// están activas. Las fuentes que agrega el equipo viven en la tabla "fuentes".

import type { FuenteIntegrada } from '~types/fuente.types';

export interface FichaFuente {
  clave: FuenteIntegrada;
  nombre: string;
  descripcion: string;
  /** Qué datos de contacto trae. */
  contacto: string;
  enlace: string;
}

export const FICHAS_INTEGRADAS: readonly FichaFuente[] = [
  {
    clave: 'dane',
    nombre: 'DANE',
    descripcion: 'DANE – Registro Estadístico de Empresas (personas jurídicas activas)',
    contacto: 'NIT, dirección, CIIU, coordenadas; sin teléfono ni correo',
    enlace: 'https://geoportal.dane.gov.co/geovisores/economia/directorio-estadistico-de-empresas/',
  },
  {
    clave: 'osm',
    nombre: 'OpenStreetMap',
    descripcion: 'OpenStreetMap (Overpass API)',
    contacto: 'Nombre comercial, coordenadas y a veces teléfono, web, correo y redes',
    enlace: 'https://www.openstreetmap.org/copyright',
  },
  {
    clave: 'rnt',
    nombre: 'Registro Nacional de Turismo',
    descripcion: 'Registro Nacional de Turismo (datos.gov.co thwd-ivmp)',
    contacto: 'NIT, dirección, celular, teléfono y correo',
    enlace: 'https://www.datos.gov.co/d/thwd-ivmp',
  },
  {
    clave: 'secop',
    nombre: 'SECOP II',
    descripcion: 'SECOP II – Proveedores Registrados (datos.gov.co qmzu-gj57)',
    contacto: 'NIT, teléfono, correo y sitio web',
    enlace: 'https://www.datos.gov.co/d/qmzu-gj57',
  },
  {
    clave: 'reps',
    nombre: 'REPS',
    descripcion: 'REPS – Prestadores y sedes de salud (datos.gov.co c36g-9fc2)',
    contacto: 'NIT, dirección, teléfono y correo por sede',
    enlace: 'https://www.datos.gov.co/d/c36g-9fc2',
  },
];
