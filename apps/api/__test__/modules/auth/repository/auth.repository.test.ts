// Integration tests against the real test database (DATABASE_URL_TEST).
import * as repo from 'modules/auth/repository/auth.repository';
import { createTestUser, describeWithDb, resetDb, prisma } from '../../../setup/db';

async function leadContactedBy(userId: number | null, contacted = true, n = 1): Promise<void> {
  await prisma.lead.create({
    data: {
      name: `Lead ${n}`, municipalityCode: '05615', municipality: 'RIONEGRO', department: 'Antioquia', originSource: 'osm',
      contacted, contactedById: userId, contactedAt: contacted ? new Date() : null,
    },
  });
}

describeWithDb('auth.repository.findMembers', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('excludes ADMIN and inactive users, sorts by name and counts only contacted leads', async () => {
    const andres = await createTestUser();
    const camila = await createTestUser({ email: 'camila@gmail.com', fullName: 'Camila Rojas' });
    const admin = await createTestUser({ email: 'admin@gmail.com', fullName: 'Administrador', role: 'ADMIN' });
    const inactive = await createTestUser({ email: 'beto@gmail.com', fullName: 'Beto Inactivo' });
    await prisma.user.update({ where: { id: inactive }, data: { active: false } });

    await leadContactedBy(andres, true, 1);
    await leadContactedBy(andres, true, 2);
    await leadContactedBy(camila, false, 3); // assigned but not marked: does not count
    await leadContactedBy(admin, true, 4);

    expect(await repo.findMembers()).toEqual([
      { id: andres, fullName: 'Andres Saray', email: 'andres@gmail.com', contacted: 2 },
      { id: camila, fullName: 'Camila Rojas', email: 'camila@gmail.com', contacted: 0 },
    ]);
  });
});
