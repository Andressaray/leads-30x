-- Fuentes administrables: las cinco integradas se pueden activar o desactivar, y el
-- equipo puede agregar (y quitar) datasets de datos.gov.co sin programar.

-- CreateEnum
CREATE TYPE "TipoFuente" AS ENUM ('INTEGRADA', 'DATOS_ABIERTOS');

-- CreateTable
CREATE TABLE "fuentes" (
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "contacto" TEXT,
    "enlace" TEXT,
    "tipo" "TipoFuente" NOT NULL DEFAULT 'DATOS_ABIERTOS',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "dataset" TEXT,
    "campos" JSONB,
    "condicion" TEXT,
    "categorias" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fuentes_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE INDEX "fuentes_activa_idx" ON "fuentes"("activa");
CREATE INDEX "fuentes_creado_por_id_idx" ON "fuentes"("creado_por_id");

-- AddForeignKey
ALTER TABLE "fuentes" ADD CONSTRAINT "fuentes_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Las cinco fuentes integradas, activas.
INSERT INTO "fuentes" ("clave", "nombre", "descripcion", "contacto", "enlace", "tipo", "updated_at") VALUES
  ('dane', 'DANE', 'DANE – Registro Estadístico de Empresas (personas jurídicas activas)', 'NIT, dirección, CIIU, coordenadas; sin teléfono ni correo', 'https://geoportal.dane.gov.co/geovisores/economia/directorio-estadistico-de-empresas/', 'INTEGRADA', CURRENT_TIMESTAMP),
  ('osm', 'OpenStreetMap', 'OpenStreetMap (Overpass API)', 'Nombre comercial, coordenadas y a veces teléfono, web, correo y redes', 'https://www.openstreetmap.org/copyright', 'INTEGRADA', CURRENT_TIMESTAMP),
  ('rnt', 'Registro Nacional de Turismo', 'Registro Nacional de Turismo (datos.gov.co thwd-ivmp)', 'NIT, dirección, celular, teléfono y correo', 'https://www.datos.gov.co/d/thwd-ivmp', 'INTEGRADA', CURRENT_TIMESTAMP),
  ('secop', 'SECOP II', 'SECOP II – Proveedores Registrados (datos.gov.co qmzu-gj57)', 'NIT, teléfono, correo y sitio web', 'https://www.datos.gov.co/d/qmzu-gj57', 'INTEGRADA', CURRENT_TIMESTAMP),
  ('reps', 'REPS', 'REPS – Prestadores y sedes de salud (datos.gov.co c36g-9fc2)', 'NIT, dirección, teléfono y correo por sede', 'https://www.datos.gov.co/d/c36g-9fc2', 'INTEGRADA', CURRENT_TIMESTAMP)
ON CONFLICT ("clave") DO NOTHING;
