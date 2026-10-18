import type { NextFunction, Request, Response } from 'express';
import { errorHandler, notFoundHandler } from 'middlewares/errorHandler';
import { AppError, HttpCode } from '~response/index';

function res() {
  const r = { status: jest.fn(), json: jest.fn() };
  r.status.mockReturnValue(r);
  return r as unknown as Response & { status: jest.Mock; json: jest.Mock };
}
const req = { path: '/x', method: 'GET' } as Request;
const next = jest.fn() as NextFunction;

describe('errorHandler', () => {
  it('respeta AppError', () => {
    const r = res();
    errorHandler(new AppError(HttpCode.CONFLICT, 'choque', { a: 1 }), req, r, next);
    expect(r.status).toHaveBeenCalledWith(409);
    expect(r.json).toHaveBeenCalledWith({ error: 'choque', status: 409, details: { a: 1 } });
  });

  it('JSON inválido → 400; cualquier otro error → 500 genérico', () => {
    const r1 = res();
    errorHandler({ type: 'entity.parse.failed' }, req, r1, next);
    expect(r1.status).toHaveBeenCalledWith(400);
    const r2 = res();
    errorHandler(new Error('detalle interno'), req, r2, next);
    expect(r2.json).toHaveBeenCalledWith({ error: 'Error interno.', status: 500 });
  });

  it('notFoundHandler', () => {
    const r = res();
    notFoundHandler(req, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });
});
