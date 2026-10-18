-- Usuarios con login (rol SERVICE o ADMIN) y quién contactó cada lead.

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('SERVICE', 'ADMIN');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'SERVICE',
    "password_hash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "contactado_por_id" INTEGER;

-- CreateIndex
CREATE INDEX "leads_contactado_por_id_idx" ON "leads"("contactado_por_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contactado_por_id_fkey" FOREIGN KEY ("contactado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
