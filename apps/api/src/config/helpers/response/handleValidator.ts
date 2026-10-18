import type { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from './appError';
import { HttpCode } from './httpCode';
import { handleError } from './response';

/** Turns the first express-validator error into a 400 response with the error envelope. */
export function handleValidator(req: Request, res: Response, next: NextFunction): void {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const first = result.array({ onlyFirstError: true })[0];
  const field = first.type === 'field' ? first.path : undefined;
  const error = new AppError(HttpCode.BAD_REQUEST, String(first.msg), field ? { field } : undefined);
  handleError(res, error.status, error.message, error.details);
}
