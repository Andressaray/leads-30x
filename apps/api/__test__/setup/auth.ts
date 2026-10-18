// Sessions for the HTTP tests: signs tokens with the test JWT_SECRET.
import type { SessionUser } from '~types/auth.types';
import { signToken } from '~utils/token';

export const ANDRES: SessionUser = { id: 1, email: 'andres@gmail.com', fullName: 'Andres Saray', role: 'SERVICE' };
export const ADMIN: SessionUser = { id: 3, email: 'admin@gmail.com', fullName: 'Administrador', role: 'ADMIN' };

export function tokenFor(user: SessionUser = ANDRES, expiresIn = '1h'): string {
  return signToken(user, process.env.JWT_SECRET!, expiresIn);
}

export const bearer = (user: SessionUser = ANDRES) => `Bearer ${tokenFor(user)}`;
