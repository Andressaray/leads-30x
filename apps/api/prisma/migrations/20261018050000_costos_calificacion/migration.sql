-- Punto 3 (Medir): costos por canal y periodo para calcular el CPL.
-- Punto 4 (Calificar): envíos a Dapta y calificación de cada lead.

-- Las llamadas del agente de Dapta quedan en el historial con su propio canal.
ALTER TYPE "CanalContacto" ADD VALUE 'DAPTA';

-- CreateEnum
CREATE TYPE "CalidadLead" AS ENUM ('ALTA', 'MEDIA', 'BAJA', 'DESCARTADO');
CREATE TYPE "OrigenCalificacion" AS ENUM ('DAPTA', 'MANUAL');
CREATE TYPE "EstadoCalificacion" AS ENUM ('ENVIADO', 'SIMULADO', 'FALLIDO', 'CALIFICADO', 'SIN_CONTACTO');
CREATE TYPE "TipoCosto" AS ENUM ('GASTO', 'HORAS');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "calidad" "CalidadLead";
ALTER TABLE "leads" ADD COLUMN "puntaje" INTEGER;
ALTER TABLE "leads" ADD COLUMN "calificado_en" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "calificaciones" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "usuario_id" INTEGER,
    "origen" "OrigenCalificacion" NOT NULL,
    "estado" "EstadoCalificacion" NOT NULL,
    "referencia" TEXT NOT NULL,
    "calidad" "CalidadLead",
    "puntaje" INTEGER,
    "resumen" TEXT,
    "variables" JSONB,
    "llamada_id" TEXT,
    "error" TEXT,
    "calificado_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "costos" (
    "id" SERIAL NOT NULL,
    "canal" TEXT NOT NULL,
    "tipo" "TipoCosto" NOT NULL DEFAULT 'GASTO',
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "horas" DECIMAL(8,2),
    "valor_hora" DECIMAL(12,2),
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "costos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_calidad_idx" ON "leads"("calidad");
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");
CREATE UNIQUE INDEX "calificaciones_referencia_key" ON "calificaciones"("referencia");
CREATE INDEX "calificaciones_lead_id_idx" ON "calificaciones"("lead_id");
CREATE INDEX "calificaciones_usuario_id_idx" ON "calificaciones"("usuario_id");
CREATE INDEX "calificaciones_estado_idx" ON "calificaciones"("estado");
CREATE INDEX "costos_canal_idx" ON "costos"("canal");
CREATE INDEX "costos_desde_hasta_idx" ON "costos"("desde", "hasta");
CREATE INDEX "costos_creado_por_id_idx" ON "costos"("creado_por_id");

-- AddForeignKey
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "costos" ADD CONSTRAINT "costos_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
