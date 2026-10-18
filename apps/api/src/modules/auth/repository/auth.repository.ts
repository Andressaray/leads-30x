// Acceso a datos de usuarios. Una función por consulta, sin reglas de negocio.
import { prisma } from '~config/db/client';
import type { MiembroDTO, UsuarioConHashDTO, UsuarioDTO } from '../types/auth.types';

const SIN_HASH = { id: true, email: true, fullName: true, rol: true, activo: true, createdAt: true, updatedAt: true } as const;

export async function findUsuarioPorEmail(email: string): Promise<UsuarioConHashDTO | null> {
  return prisma.usuario.findUnique({ where: { email } });
}

export async function findUsuarioPorId(id: number): Promise<UsuarioDTO | null> {
  return prisma.usuario.findUnique({ where: { id }, select: SIN_HASH });
}

export async function findUsuarios(): Promise<UsuarioDTO[]> {
  return prisma.usuario.findMany({ select: SIN_HASH, orderBy: { fullName: 'asc' } });
}

/** Usuarios activos que no son ADMIN, con cuántos leads contactó cada uno. */
export async function findMiembros(): Promise<MiembroDTO[]> {
  const filas = await prisma.usuario.findMany({
    where: { activo: true, rol: { not: 'ADMIN' } },
    select: {
      id: true,
      fullName: true,
      email: true,
      _count: { select: { leadsContactados: { where: { contactado: true } } } },
    },
    orderBy: { fullName: 'asc' },
  });
  return filas.map(({ _count, ...u }) => ({ ...u, contactados: _count.leadsContactados }));
}
