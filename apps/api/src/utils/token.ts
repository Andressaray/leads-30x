// Firma y verificación de los tokens de sesión (JWT HS256).
import jwt from 'jsonwebtoken';
import { ROLES, type UsuarioSesion } from '~types/auth.types';

interface Payload {
  sub: string;
  email: string;
  fullName: string;
  rol: string;
}

export function firmarToken(usuario: UsuarioSesion, secreto: string, expiraEn: string): string {
  const payload: Omit<Payload, 'sub'> = { email: usuario.email, fullName: usuario.fullName, rol: usuario.rol };
  return jwt.sign(payload, secreto, {
    algorithm: 'HS256',
    subject: String(usuario.id),
    expiresIn: expiraEn as jwt.SignOptions['expiresIn'],
  });
}

/** Devuelve el usuario del token, o null si la firma no es válida, expiró o el contenido no cuadra. */
export function verificarToken(token: string, secreto: string): UsuarioSesion | null {
  try {
    const p = jwt.verify(token, secreto, { algorithms: ['HS256'] }) as Partial<Payload>;
    const id = Number(p.sub);
    if (!Number.isInteger(id) || id < 1 || !p.email || !p.fullName) return null;
    if (!ROLES.includes(p.rol as UsuarioSesion['rol'])) return null;
    return { id, email: p.email, fullName: p.fullName, rol: p.rol as UsuarioSesion['rol'] };
  } catch {
    return null;
  }
}
