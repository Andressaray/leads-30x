import type { NextFunction, Request, Response } from 'express';
import { requireRole, verifyAuth } from 'middlewares/verifyAuth';
import { ADMIN, ANDRES, tokenFor } from '../setup/auth';

const SECRET = process.env.JWT_SECRET!;

function res() {
  const r = { status: jest.fn(), json: jest.fn() };
  r.status.mockReturnValue(r);
  return r as unknown as Response & { status: jest.Mock; json: jest.Mock };
}

const req = (authorization?: string) => ({ headers: authorization ? { authorization } : {} }) as Request;

describe('verifyAuth', () => {
  it('with a valid token it lets the request through and puts the user in req.user', () => {
    const next = jest.fn() as NextFunction;
    const r = req(`Bearer ${tokenFor(ANDRES)}`);
    verifyAuth(SECRET)(r, res(), next);
    expect(next).toHaveBeenCalled();
    expect(r.user).toEqual(ANDRES);
  });

  it('401 when the token is missing', () => {
    const next = jest.fn() as NextFunction;
    const r = res();
    verifyAuth(SECRET)(req(), r, next);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['firmado con otra clave', () => `Bearer ${require('~utils/token').signToken(ANDRES, 'other-key-other-key-other-key-xxx', '1h')}`],
    ['vencido', () => `Bearer ${tokenFor(ANDRES, '-1s')}`],
    ['basura', () => 'Bearer abc.def.ghi'],
  ])('401 when the token is %s', (_case, header) => {
    const next = jest.fn() as NextFunction;
    const r = res();
    verifyAuth(SECRET)(req(header()), r, next);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  it('lets the allowed role through and responds 403 to the rest', () => {
    const next = jest.fn() as NextFunction;
    requireRole('ADMIN')({ user: ADMIN } as Request, res(), next);
    expect(next).toHaveBeenCalledTimes(1);
    const r = res();
    requireRole('ADMIN')({ user: ANDRES } as Request, r, next);
    expect(r.status).toHaveBeenCalledWith(403);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
