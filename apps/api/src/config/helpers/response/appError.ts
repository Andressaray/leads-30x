import { HttpCode } from './httpCode';

/** Expected error (business or validation) with its HTTP status code. */
export class AppError extends Error {
  constructor(
    public readonly status: HttpCode,
    message: string,
    /** Extra data for the client, e.g. the options when a city is ambiguous */
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}
