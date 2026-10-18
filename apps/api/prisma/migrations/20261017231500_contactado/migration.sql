-- Agrega el estado de "ya contactado" de un lead (botón Contactar en la UI).
ALTER TABLE "leads" ADD COLUMN "contactado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leads" ADD COLUMN "contactado_en" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "leads_contactado_idx" ON "leads"("contactado");
