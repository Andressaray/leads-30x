// Autenticación por sesión: todas las rutas /api (salvo el login) piden
// "Authorization: Bearer <token>", el token que devuelve POST /api/auth/login.
// Si el token es válido deja el usuario en req.usuario.

import type { NextFunction, Request, Response } from 'express';
import { HttpCode, handleError } from '~response/index';
import type { Rol } from '~types/auth.types';
import { verificarToken } from '~utils/token';

export function verifyAuth(secreto: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    if (!token) return handleError(res, HttpCode.UNAUTHORIZED, 'Inicia sesión para continuar.');
    const usuario = verificarToken(token, secreto);
    if (!usuario) return handleError(res, HttpCode.UNAUTHORIZED, 'La sesión expiró o no es válida. Inicia sesión de nuevo.');
    req.usuario = usuario;
    next();
  };
}

/** Solo deja pasar a los roles indicados (usar después de verifyAuth). */
export function requireRol(...roles: Rol[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuario) return handleError(res, HttpCode.UNAUTHORIZED, 'Inicia sesión para continuar.');
    if (!roles.includes(req.usuario.rol)) return handleError(res, HttpCode.FORBIDDEN, 'No tienes permiso para esta acción.');
    next();
  };
}
