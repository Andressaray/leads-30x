// Sesiones para las pruebas HTTP: firma tokens con el JWT_SECRET de pruebas.
import type { UsuarioSesion } from '~types/auth.types';
import { firmarToken } from '~utils/token';

export const ANDRES: UsuarioSesion = { id: 1, email: 'andres@gmail.com', fullName: 'Andres Saray', rol: 'SERVICE' };
export const ADMIN: UsuarioSesion = { id: 3, email: 'admin@gmail.com', fullName: 'Administrador', rol: 'ADMIN' };

export function tokenDe(usuario: UsuarioSesion = ANDRES, expiraEn = '1h'): string {
  return firmarToken(usuario, process.env.JWT_SECRET!, expiraEn);
}

export const bearer = (usuario: UsuarioSesion = ANDRES) => `Bearer ${tokenDe(usuario)}`;
