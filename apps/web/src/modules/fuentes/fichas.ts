// Fuentes que se muestran en la pantalla "Fuentes". Copia del catálogo de la API
// (apps/api/src/config/catalogo/fuentes.ts) para que la pantalla funcione sin consultarla.
import type { NombreFuente } from "@/modules/leads";

export interface FichaFuente {
  clave: NombreFuente;
  nombre: string;
  descripcion: string;
  /** Qué datos de contacto trae. */
  contacto: string;
  enlace: string;
}

export const FICHAS_FUENTES: readonly FichaFuente[] = [
  {
    clave: "dane",
    nombre: "DANE",
    descripcion: "Registro Estadístico de Empresas (personas jurídicas activas)",
    contacto: "NIT, dirección, CIIU, coordenadas; sin teléfono ni correo",
    enlace: "https://geoportal.dane.gov.co/geovisores/economia/directorio-estadistico-de-empresas/",
  },
  {
    clave: "osm",
    nombre: "OpenStreetMap",
    descripcion: "Negocios mapeados en OpenStreetMap (Overpass API)",
    contacto: "Nombre comercial, coordenadas y a veces teléfono, web, correo y redes",
    enlace: "https://www.openstreetmap.org/copyright",
  },
  {
    clave: "rnt",
    nombre: "Registro Nacional de Turismo",
    descripcion: "Prestadores turísticos inscritos (datos.gov.co thwd-ivmp)",
    contacto: "NIT, dirección, celular, teléfono y correo",
    enlace: "https://www.datos.gov.co/d/thwd-ivmp",
  },
  {
    clave: "secop",
    nombre: "SECOP II",
    descripcion: "Proveedores registrados en compra pública (datos.gov.co qmzu-gj57)",
    contacto: "NIT, teléfono, correo y sitio web",
    enlace: "https://www.datos.gov.co/d/qmzu-gj57",
  },
  {
    clave: "reps",
    nombre: "REPS",
    descripcion: "Prestadores y sedes de salud (datos.gov.co c36g-9fc2)",
    contacto: "NIT, dirección, teléfono y correo por sede",
    enlace: "https://www.datos.gov.co/d/c36g-9fc2",
  },
];
