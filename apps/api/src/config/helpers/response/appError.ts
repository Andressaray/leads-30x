import { HttpCode } from './httpCode';

/** Error esperado (de negocio o de validación) con su código HTTP. */
export class AppError extends Error {
  constructor(
    public readonly status: HttpCode,
    message: string,
    /** Datos extra para el cliente, ej. las opciones cuando una ciudad es ambigua */
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}
