-- CreateTable
CREATE TABLE "busquedas" (
    "id" SERIAL NOT NULL,
    "ciudad_texto" TEXT,
    "departamento_texto" TEXT,
    "cod_mpio" CHAR(5) NOT NULL,
    "municipio" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "categoria" TEXT,
    "filtros" JSONB NOT NULL,
    "fuentes_pedidas" TEXT[],
    "estado" TEXT NOT NULL DEFAULT 'en_curso',
    "resumen" JSONB,
    "terminado_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "busquedas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "busqueda_fuentes" (
    "busqueda_id" INTEGER NOT NULL,
    "fuente" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "registros" INTEGER NOT NULL DEFAULT 0,
    "nuevos" INTEGER NOT NULL DEFAULT 0,
    "enriquecidos" INTEGER NOT NULL DEFAULT 0,
    "sin_cambios" INTEGER NOT NULL DEFAULT 0,
    "omitidos" INTEGER NOT NULL DEFAULT 0,
    "duracion_ms" INTEGER,
    "error" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "busqueda_fuentes_pkey" PRIMARY KEY ("busqueda_id","fuente")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombre_comercial" TEXT,
    "razon_social" TEXT,
    "nombres_norm" TEXT NOT NULL DEFAULT '',
    "nit" TEXT,
    "cod_mpio" CHAR(5) NOT NULL,
    "municipio" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "direccion" TEXT,
    "direccion_norm" TEXT,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "ciiu" TEXT,
    "categoria_fuente" TEXT,
    "categorias" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "telefonos" JSONB NOT NULL DEFAULT '[]',
    "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sitios_web" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "redes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "canal_principal" TEXT,
    "contactable" BOOLEAN NOT NULL DEFAULT false,
    "es_persona_natural" BOOLEAN,
    "fuentes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "num_fuentes" INTEGER NOT NULL DEFAULT 1,
    "fuente_origen" TEXT NOT NULL,
    "busqueda_origen_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_claves" (
    "tipo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_claves_pkey" PRIMARY KEY ("tipo","valor")
);

-- CreateTable
CREATE TABLE "apariciones" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "fuente" TEXT NOT NULL,
    "id_externo" TEXT NOT NULL,
    "coincidencia" TEXT NOT NULL,
    "datos" JSONB,
    "busqueda_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apariciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "busqueda_leads" (
    "busqueda_id" INTEGER NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "fuente" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "busqueda_leads_pkey" PRIMARY KEY ("busqueda_id","lead_id","fuente")
);

-- CreateIndex
CREATE INDEX "busquedas_cod_mpio_idx" ON "busquedas"("cod_mpio");

-- CreateIndex
CREATE INDEX "busqueda_fuentes_busqueda_id_idx" ON "busqueda_fuentes"("busqueda_id");

-- CreateIndex
CREATE INDEX "leads_cod_mpio_lat_lon_idx" ON "leads"("cod_mpio", "lat", "lon");

-- CreateIndex
CREATE INDEX "leads_cod_mpio_direccion_norm_idx" ON "leads"("cod_mpio", "direccion_norm");

-- CreateIndex
CREATE INDEX "leads_nit_idx" ON "leads"("nit");

-- CreateIndex
CREATE INDEX "leads_contactable_idx" ON "leads"("contactable");

-- CreateIndex
CREATE INDEX "leads_busqueda_origen_id_idx" ON "leads"("busqueda_origen_id");

-- CreateIndex
CREATE INDEX "lead_claves_lead_id_idx" ON "lead_claves"("lead_id");

-- CreateIndex
CREATE INDEX "apariciones_lead_id_idx" ON "apariciones"("lead_id");

-- CreateIndex
CREATE INDEX "apariciones_busqueda_id_idx" ON "apariciones"("busqueda_id");

-- CreateIndex
CREATE UNIQUE INDEX "apariciones_fuente_id_externo_key" ON "apariciones"("fuente", "id_externo");

-- CreateIndex
CREATE INDEX "busqueda_leads_busqueda_id_idx" ON "busqueda_leads"("busqueda_id");

-- CreateIndex
CREATE INDEX "busqueda_leads_lead_id_idx" ON "busqueda_leads"("lead_id");

-- AddForeignKey
ALTER TABLE "busqueda_fuentes" ADD CONSTRAINT "busqueda_fuentes_busqueda_id_fkey" FOREIGN KEY ("busqueda_id") REFERENCES "busquedas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_busqueda_origen_id_fkey" FOREIGN KEY ("busqueda_origen_id") REFERENCES "busquedas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_claves" ADD CONSTRAINT "lead_claves_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apariciones" ADD CONSTRAINT "apariciones_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apariciones" ADD CONSTRAINT "apariciones_busqueda_id_fkey" FOREIGN KEY ("busqueda_id") REFERENCES "busquedas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "busqueda_leads" ADD CONSTRAINT "busqueda_leads_busqueda_id_fkey" FOREIGN KEY ("busqueda_id") REFERENCES "busquedas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "busqueda_leads" ADD CONSTRAINT "busqueda_leads_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
