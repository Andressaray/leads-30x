// Single instance of the database client. Import it from here; never
// create another PrismaClient inside a module.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { environment } from '~config/environment';

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: environment.databaseUrl }),
});

export type { Prisma } from '../../generated/prisma/client';
