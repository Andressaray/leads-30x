// Last-resort safety net. Mounted last in config/app.ts.

import type { NextFunction, Request, Response } from 'express';
import { logger } from '~config/logger';
import { AppError, HttpCode, handleError } from '~response/index';

export function notFoundHandler(req: Request, res: Response): void {
  handleError(res, HttpCode.NOT_FOUND, `Ruta no encontrada: ${req.method} ${req.path}`);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) return handleError(res, err.status, err.message, err.details);
  if ((err as { type?: string })?.type === 'entity.parse.failed') {
    return handleError(res, HttpCode.BAD_REQUEST, 'El cuerpo no es JSON válido.');
  }
  logger.error({ err, path: req.path }, 'Unhandled error');
  handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Error interno.');
}
