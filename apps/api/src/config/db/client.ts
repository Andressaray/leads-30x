// Única instancia del cliente de base de datos. Impórtala desde aquí; nunca
// crees otro PrismaClient dentro de un módulo.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { environment } from '~config/environment';

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: environment.databaseUrl }),
});

export type { Prisma } from '../../generated/prisma/client';
