// Helpers for the repository tests against the real test database.
import { prisma } from '~config/db/client';

export const hasTestDb = Boolean(process.env.DATABASE_URL_TEST);

/** describe() that is skipped (with a notice) when no test database is configured. */
export const describeWithDb: jest.Describe = hasTestDb ? describe : describe.skip;

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE qualifications, costs, interactions, templates, search_leads, occurrences, lead_keys, leads, search_sources, searches, users RESTART IDENTITY CASCADE'
  );
}

export async function createTestSearch(municipalityCode = '05615'): Promise<number> {
  const b = await prisma.search.create({
    data: { municipalityCode, municipality: 'RIONEGRO', department: 'Antioquia', filters: {}, requestedSources: ['dane'] },
  });
  return b.id;
}

export { prisma };

/** Creates a test user (password with a cheap hash so the test is fast). */
export async function createTestUser(
  p: { email?: string; fullName?: string; role?: 'SERVICE' | 'ADMIN'; password?: string } = {}
): Promise<number> {
  const bcrypt = await import('bcryptjs');
  const u = await prisma.user.create({
    data: {
      email: p.email ?? 'andres@gmail.com',
      fullName: p.fullName ?? 'Andres Saray',
      role: p.role ?? 'SERVICE',
      passwordHash: bcrypt.hashSync(p.password ?? 'Andres1234*', 4),
    },
  });
  return u.id;
}
