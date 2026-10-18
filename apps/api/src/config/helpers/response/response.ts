import type { Response } from 'express';
import { HttpCode } from './httpCode';

export interface SuccessEnvelope<T> {
  data: T;
  status: number;
}

export interface ErrorEnvelope {
  error: string;
  status: number;
  details?: unknown;
}

export function handleSuccess<T>(res: Response, status: HttpCode, data: T): void {
  const body: SuccessEnvelope<T> = { data, status };
  res.status(status).json(body);
}

export function handleError(res: Response, status: HttpCode, message: string, details?: unknown): void {
  const body: ErrorEnvelope = { error: message, status, ...(details !== undefined ? { details } : {}) };
  res.status(status).json(body);
}

/** For downloads (CSV): the body is the file, not the JSON envelope. */
export function handleFile(res: Response, filename: string, contentType: string, content: string | Buffer): void {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(HttpCode.OK).send(content);
}
