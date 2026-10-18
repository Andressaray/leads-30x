// User data access. One function per query, no business rules.
import { prisma } from '~config/db/client';
import type { MemberDTO, UserWithHashDTO, UserDTO } from '../types/auth.types';

const WITHOUT_HASH = { id: true, email: true, fullName: true, role: true, active: true, createdAt: true, updatedAt: true } as const;

export async function findUserByEmail(email: string): Promise<UserWithHashDTO | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserById(id: number): Promise<UserDTO | null> {
  return prisma.user.findUnique({ where: { id }, select: WITHOUT_HASH });
}

export async function findUsers(): Promise<UserDTO[]> {
  return prisma.user.findMany({ select: WITHOUT_HASH, orderBy: { fullName: 'asc' } });
}

/** Active users that are not ADMIN, with how many leads each one contacted. */
export async function findMembers(): Promise<MemberDTO[]> {
  const rows = await prisma.user.findMany({
    where: { active: true, role: { not: 'ADMIN' } },
    select: {
      id: true,
      fullName: true,
      email: true,
      _count: { select: { contactedLeads: { where: { contacted: true } } } },
    },
    orderBy: { fullName: 'asc' },
  });
  return rows.map(({ _count, ...u }) => ({ ...u, contacted: _count.contactedLeads }));
}
