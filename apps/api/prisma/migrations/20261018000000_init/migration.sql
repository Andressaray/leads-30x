-- Initial schema (English). Replaces the previous Spanish migrations: start from an empty database.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SERVICE', 'ADMIN');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('PENDING', 'CONTACTED', 'REPLIED', 'INTERESTED', 'NOT_INTERESTED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'CALL', 'OTHER', 'DAPTA');

-- CreateEnum
CREATE TYPE "InteractionDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "InteractionStatus" AS ENUM ('SENT', 'SIMULATED', 'FAILED', 'RECORDED');

-- CreateEnum
CREATE TYPE "LeadQuality" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'DISCARDED');

-- CreateEnum
CREATE TYPE "QualificationOrigin" AS ENUM ('DAPTA', 'MANUAL');

-- CreateEnum
CREATE TYPE "QualificationStatus" AS ENUM ('SENT', 'SIMULATED', 'FAILED', 'QUALIFIED', 'NO_CONTACT');

-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('EXPENSE', 'HOURS');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('BUILT_IN', 'OPEN_DATA');

-- CreateTable
CREATE TABLE "searches" (
    "id" SERIAL NOT NULL,
    "city_text" TEXT,
    "department_text" TEXT,
    "municipality_code" CHAR(5) NOT NULL,
    "municipality" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "category" TEXT,
    "filters" JSONB NOT NULL,
    "requested_sources" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "summary" JSONB,
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_sources" (
    "search_id" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "records" INTEGER NOT NULL DEFAULT 0,
    "new" INTEGER NOT NULL DEFAULT 0,
    "enriched" INTEGER NOT NULL DEFAULT 0,
    "unchanged" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "error" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_sources_pkey" PRIMARY KEY ("search_id","source")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "trade_name" TEXT,
    "legal_name" TEXT,
    "names_norm" TEXT NOT NULL DEFAULT '',
    "nit" TEXT,
    "municipality_code" CHAR(5) NOT NULL,
    "municipality" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "address" TEXT,
    "address_norm" TEXT,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "ciiu" TEXT,
    "source_category" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phones" JSONB NOT NULL DEFAULT '[]',
    "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "websites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "social_links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primary_channel" TEXT,
    "contactable" BOOLEAN NOT NULL DEFAULT false,
    "contacted" BOOLEAN NOT NULL DEFAULT false,
    "contacted_at" TIMESTAMP(3),
    "contacted_by_id" INTEGER,
    "contact_status" "ContactStatus" NOT NULL DEFAULT 'PENDING',
    "last_contacted_at" TIMESTAMP(3),
    "replied_at" TIMESTAMP(3),
    "do_not_contact" BOOLEAN NOT NULL DEFAULT false,
    "do_not_contact_at" TIMESTAMP(3),
    "quality" "LeadQuality",
    "score" INTEGER,
    "qualified_at" TIMESTAMP(3),
    "is_individual" BOOLEAN,
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source_count" INTEGER NOT NULL DEFAULT 1,
    "origin_source" TEXT NOT NULL,
    "origin_search_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_keys" (
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_keys_pkey" PRIMARY KEY ("type","value")
);

-- CreateTable
CREATE TABLE "occurrences" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "match" TEXT NOT NULL,
    "data" JSONB,
    "search_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_leads" (
    "search_id" INTEGER NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_leads_pkey" PRIMARY KEY ("search_id","lead_id","source")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SERVICE',
    "password_hash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interactions" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "channel" "ContactChannel" NOT NULL,
    "direction" "InteractionDirection" NOT NULL,
    "status" "InteractionStatus" NOT NULL,
    "destination" TEXT,
    "subject" TEXT,
    "message" TEXT,
    "note" TEXT,
    "result" "ContactStatus",
    "error" TEXT,
    "provider_id" TEXT,
    "template_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "ContactChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualifications" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "origin" "QualificationOrigin" NOT NULL,
    "status" "QualificationStatus" NOT NULL,
    "reference" TEXT NOT NULL,
    "quality" "LeadQuality",
    "score" INTEGER,
    "summary" TEXT,
    "variables" JSONB,
    "call_id" TEXT,
    "error" TEXT,
    "qualified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "costs" (
    "id" SERIAL NOT NULL,
    "channel" TEXT NOT NULL,
    "type" "CostType" NOT NULL DEFAULT 'EXPENSE',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "hours" DECIMAL(8,2),
    "hourly_rate" DECIMAL(12,2),
    "from" DATE NOT NULL,
    "to" DATE NOT NULL,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "contact" TEXT,
    "link" TEXT,
    "type" "SourceType" NOT NULL DEFAULT 'OPEN_DATA',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "dataset" TEXT,
    "fields" JSONB,
    "condition" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "searches_municipality_code_idx" ON "searches"("municipality_code");

-- CreateIndex
CREATE INDEX "search_sources_search_id_idx" ON "search_sources"("search_id");

-- CreateIndex
CREATE INDEX "leads_municipality_code_lat_lon_idx" ON "leads"("municipality_code", "lat", "lon");

-- CreateIndex
CREATE INDEX "leads_municipality_code_address_norm_idx" ON "leads"("municipality_code", "address_norm");

-- CreateIndex
CREATE INDEX "leads_nit_idx" ON "leads"("nit");

-- CreateIndex
CREATE INDEX "leads_contactable_idx" ON "leads"("contactable");

-- CreateIndex
CREATE INDEX "leads_contacted_idx" ON "leads"("contacted");

-- CreateIndex
CREATE INDEX "leads_contacted_by_id_idx" ON "leads"("contacted_by_id");

-- CreateIndex
CREATE INDEX "leads_contact_status_idx" ON "leads"("contact_status");

-- CreateIndex
CREATE INDEX "leads_quality_idx" ON "leads"("quality");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "leads_origin_search_id_idx" ON "leads"("origin_search_id");

-- CreateIndex
CREATE INDEX "lead_keys_lead_id_idx" ON "lead_keys"("lead_id");

-- CreateIndex
CREATE INDEX "occurrences_lead_id_idx" ON "occurrences"("lead_id");

-- CreateIndex
CREATE INDEX "occurrences_search_id_idx" ON "occurrences"("search_id");

-- CreateIndex
CREATE UNIQUE INDEX "occurrences_source_external_id_key" ON "occurrences"("source", "external_id");

-- CreateIndex
CREATE INDEX "search_leads_search_id_idx" ON "search_leads"("search_id");

-- CreateIndex
CREATE INDEX "search_leads_lead_id_idx" ON "search_leads"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "interactions_lead_id_idx" ON "interactions"("lead_id");

-- CreateIndex
CREATE INDEX "interactions_user_id_idx" ON "interactions"("user_id");

-- CreateIndex
CREATE INDEX "interactions_template_id_idx" ON "interactions"("template_id");

-- CreateIndex
CREATE INDEX "interactions_channel_created_at_idx" ON "interactions"("channel", "created_at");

-- CreateIndex
CREATE INDEX "templates_created_by_id_idx" ON "templates"("created_by_id");

-- CreateIndex
CREATE INDEX "templates_channel_active_idx" ON "templates"("channel", "active");

-- CreateIndex
CREATE UNIQUE INDEX "qualifications_reference_key" ON "qualifications"("reference");

-- CreateIndex
CREATE INDEX "qualifications_lead_id_idx" ON "qualifications"("lead_id");

-- CreateIndex
CREATE INDEX "qualifications_user_id_idx" ON "qualifications"("user_id");

-- CreateIndex
CREATE INDEX "qualifications_status_idx" ON "qualifications"("status");

-- CreateIndex
CREATE INDEX "costs_channel_idx" ON "costs"("channel");

-- CreateIndex
CREATE INDEX "costs_from_to_idx" ON "costs"("from", "to");

-- CreateIndex
CREATE INDEX "costs_created_by_id_idx" ON "costs"("created_by_id");

-- CreateIndex
CREATE INDEX "sources_active_idx" ON "sources"("active");

-- CreateIndex
CREATE INDEX "sources_created_by_id_idx" ON "sources"("created_by_id");

-- AddForeignKey
ALTER TABLE "search_sources" ADD CONSTRAINT "search_sources_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "searches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_origin_search_id_fkey" FOREIGN KEY ("origin_search_id") REFERENCES "searches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contacted_by_id_fkey" FOREIGN KEY ("contacted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_keys" ADD CONSTRAINT "lead_keys_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "searches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_leads" ADD CONSTRAINT "search_leads_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "searches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_leads" ADD CONSTRAINT "search_leads_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costs" ADD CONSTRAINT "costs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The five built-in sources, active. Descriptions stay in Spanish: they are shown in the UI.
INSERT INTO "sources" ("key", "name", "description", "contact", "link", "type", "updated_at") VALUES
  ('dane', 'DANE', 'DANE – Registro Estadístico de Empresas (personas jurídicas activas)', 'NIT, dirección, CIIU, coordenadas; sin teléfono ni correo', 'https://geoportal.dane.gov.co/geovisores/economia/directorio-estadistico-de-empresas/', 'BUILT_IN', CURRENT_TIMESTAMP),
  ('osm', 'OpenStreetMap', 'OpenStreetMap (Overpass API)', 'Nombre comercial, coordenadas y a veces teléfono, web, correo y redes', 'https://www.openstreetmap.org/copyright', 'BUILT_IN', CURRENT_TIMESTAMP),
  ('rnt', 'Registro Nacional de Turismo', 'Registro Nacional de Turismo (datos.gov.co thwd-ivmp)', 'NIT, dirección, celular, teléfono y correo', 'https://www.datos.gov.co/d/thwd-ivmp', 'BUILT_IN', CURRENT_TIMESTAMP),
  ('secop', 'SECOP II', 'SECOP II – Proveedores Registrados (datos.gov.co qmzu-gj57)', 'NIT, teléfono, correo y sitio web', 'https://www.datos.gov.co/d/qmzu-gj57', 'BUILT_IN', CURRENT_TIMESTAMP),
  ('reps', 'REPS', 'REPS – Prestadores y sedes de salud (datos.gov.co c36g-9fc2)', 'NIT, dirección, teléfono y correo por sede', 'https://www.datos.gov.co/d/c36g-9fc2', 'BUILT_IN', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
