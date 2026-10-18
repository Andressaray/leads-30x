// Signing and verification of session tokens (JWT HS256).
import jwt from 'jsonwebtoken';
import { ROLES, type SessionUser } from '~types/auth.types';

interface Payload {
  sub: string;
  email: string;
  fullName: string;
  role: string;
}

export function signToken(user: SessionUser, secret: string, expiresIn: string): string {
  const payload: Omit<Payload, 'sub'> = { email: user.email, fullName: user.fullName, role: user.role };
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    subject: String(user.id),
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });
}

/** Returns the token's user, or null if the signature is invalid, it expired or the content does not match. */
export function verifyToken(token: string, secret: string): SessionUser | null {
  try {
    const p = jwt.verify(token, secret, { algorithms: ['HS256'] }) as Partial<Payload>;
    const id = Number(p.sub);
    if (!Number.isInteger(id) || id < 1 || !p.email || !p.fullName) return null;
    if (!ROLES.includes(p.role as SessionUser['role'])) return null;
    return { id, email: p.email, fullName: p.fullName, role: p.role as SessionUser['role'] };
  } catch {
    return null;
  }
}
