// Session authentication: every /api route (except login) requires
// "Authorization: Bearer <token>", the token returned by POST /api/auth/login.
// If the token is valid it puts the user in req.user.

import type { NextFunction, Request, Response } from 'express';
import { HttpCode, handleError } from '~response/index';
import type { Role } from '~types/auth.types';
import { verifyToken } from '~utils/token';

export function verifyAuth(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    if (!token) return handleError(res, HttpCode.UNAUTHORIZED, 'Inicia sesión para continuar.');
    const user = verifyToken(token, secret);
    if (!user) return handleError(res, HttpCode.UNAUTHORIZED, 'La sesión expiró o no es válida. Inicia sesión de nuevo.');
    req.user = user;
    next();
  };
}

/** Only lets the given roles through (use after verifyAuth). */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) return handleError(res, HttpCode.UNAUTHORIZED, 'Inicia sesión para continuar.');
    if (!roles.includes(req.user.role)) return handleError(res, HttpCode.FORBIDDEN, 'No tienes permiso para esta acción.');
    next();
  };
}
