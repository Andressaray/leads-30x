import type { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from './appError';
import { HttpCode } from './httpCode';
import { handleError } from './response';

/** Convierte el primer error de express-validator en una respuesta 400 con el sobre de error. */
export function handleValidator(req: Request, res: Response, next: NextFunction): void {
  const resultado = validationResult(req);
  if (resultado.isEmpty()) return next();
  const primero = resultado.array({ onlyFirstError: true })[0];
  const campo = primero.type === 'field' ? primero.path : undefined;
  const error = new AppError(HttpCode.BAD_REQUEST, String(primero.msg), campo ? { campo } : undefined);
  handleError(res, error.status, error.message, error.details);
}
