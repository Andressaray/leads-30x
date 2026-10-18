// Sources shown on the "Fuentes" screen. Copy of the API catalog
// (apps/api/src/config/catalog/sources.ts) so the screen works without querying it.
import type { SourceName } from "@/modules/leads";

export interface SourceCard {
  key: SourceName;
  name: string;
  description: string;
  /** What contact data it provides. */
  contact: string;
  link: string;
}

export const SOURCE_CARDS: readonly SourceCard[] = [
  {
    key: "dane",
    name: "DANE",
    description: "Registro Estadístico de Empresas (personas jurídicas activas)",
    contact: "NIT, dirección, CIIU, coordenadas; sin teléfono ni correo",
    link: "https://geoportal.dane.gov.co/geovisores/economia/directorio-estadistico-de-empresas/",
  },
  {
    key: "osm",
    name: "OpenStreetMap",
    description: "Negocios mapeados en OpenStreetMap (Overpass API)",
    contact: "Nombre comercial, coordenadas y a veces teléfono, web, correo y redes",
    link: "https://www.openstreetmap.org/copyright",
  },
  {
    key: "rnt",
    name: "Registro Nacional de Turismo",
    description: "Prestadores turísticos inscritos (datos.gov.co thwd-ivmp)",
    contact: "NIT, dirección, celular, teléfono y correo",
    link: "https://www.datos.gov.co/d/thwd-ivmp",
  },
  {
    key: "secop",
    name: "SECOP II",
    description: "Proveedores registrados en compra pública (datos.gov.co qmzu-gj57)",
    contact: "NIT, teléfono, correo y sitio web",
    link: "https://www.datos.gov.co/d/qmzu-gj57",
  },
  {
    key: "reps",
    name: "REPS",
    description: "Prestadores y sedes de salud (datos.gov.co c36g-9fc2)",
    contact: "NIT, dirección, teléfono y correo por sede",
    link: "https://www.datos.gov.co/d/c36g-9fc2",
  },
];
