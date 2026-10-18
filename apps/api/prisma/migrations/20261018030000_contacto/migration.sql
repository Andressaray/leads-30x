-- Punto 2 (Contactar): estado del embudo por lead, historial de interacciones,
-- plantillas de mensaje y "no volver a contactar".

-- CreateEnum
CREATE TYPE "EstadoContacto" AS ENUM ('PENDIENTE', 'CONTACTADO', 'RESPONDIO', 'INTERESADO', 'NO_INTERESADO', 'REBOTADO');
CREATE TYPE "CanalContacto" AS ENUM ('EMAIL', 'WHATSAPP', 'LLAMADA', 'OTRO');
CREATE TYPE "SentidoInteraccion" AS ENUM ('SALIENTE', 'ENTRANTE');
CREATE TYPE "EstadoInteraccion" AS ENUM ('ENVIADO', 'SIMULADO', 'FALLIDO', 'REGISTRADO');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "estado_contacto" "EstadoContacto" NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE "leads" ADD COLUMN "ultimo_contacto_en" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN "respondio_en" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN "no_contactar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leads" ADD COLUMN "no_contactar_en" TIMESTAMP(3);

-- Los leads que ya se marcaron como contactados pasan al estado CONTACTADO.
UPDATE "leads" SET "estado_contacto" = 'CONTACTADO', "ultimo_contacto_en" = "contactado_en" WHERE "contactado" = true;

-- CreateTable
CREATE TABLE "interacciones" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "usuario_id" INTEGER,
    "canal" "CanalContacto" NOT NULL,
    "sentido" "SentidoInteraccion" NOT NULL,
    "estado" "EstadoInteraccion" NOT NULL,
    "destino" TEXT,
    "asunto" TEXT,
    "mensaje" TEXT,
    "nota" TEXT,
    "resultado" "EstadoContacto",
    "error" TEXT,
    "proveedor_id" TEXT,
    "plantilla_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interacciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "canal" "CanalContacto" NOT NULL,
    "asunto" TEXT,
    "cuerpo" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantillas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_estado_contacto_idx" ON "leads"("estado_contacto");
CREATE INDEX "interacciones_lead_id_idx" ON "interacciones"("lead_id");
CREATE INDEX "interacciones_usuario_id_idx" ON "interacciones"("usuario_id");
CREATE INDEX "interacciones_plantilla_id_idx" ON "interacciones"("plantilla_id");
CREATE INDEX "interacciones_canal_created_at_idx" ON "interacciones"("canal", "created_at");
CREATE INDEX "plantillas_creado_por_id_idx" ON "plantillas"("creado_por_id");
CREATE INDEX "plantillas_canal_activa_idx" ON "plantillas"("canal", "activa");

-- AddForeignKey
ALTER TABLE "interacciones" ADD CONSTRAINT "interacciones_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interacciones" ADD CONSTRAINT "interacciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "interacciones" ADD CONSTRAINT "interacciones_plantilla_id_fkey" FOREIGN KEY ("plantilla_id") REFERENCES "plantillas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "plantillas" ADD CONSTRAINT "plantillas_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
