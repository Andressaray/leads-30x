import type { NextFunction, Request, Response } from 'express';
import { requireRol, verifyAuth } from 'middlewares/verifyAuth';
import { ADMIN, ANDRES, tokenDe } from '../setup/auth';

const SECRETO = process.env.JWT_SECRET!;

function res() {
  const r = { status: jest.fn(), json: jest.fn() };
  r.status.mockReturnValue(r);
  return r as unknown as Response & { status: jest.Mock; json: jest.Mock };
}

const req = (authorization?: string) => ({ headers: authorization ? { authorization } : {} }) as Request;

describe('verifyAuth', () => {
  it('con un token válido deja pasar y pone el usuario en req.usuario', () => {
    const next = jest.fn() as NextFunction;
    const r = req(`Bearer ${tokenDe(ANDRES)}`);
    verifyAuth(SECRETO)(r, res(), next);
    expect(next).toHaveBeenCalled();
    expect(r.usuario).toEqual(ANDRES);
  });

  it('401 si falta el token', () => {
    const next = jest.fn() as NextFunction;
    const r = res();
    verifyAuth(SECRETO)(req(), r, next);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['firmado con otra clave', () => `Bearer ${require('~utils/token').firmarToken(ANDRES, 'otra-clave-otra-clave-otra-clave-xx', '1h')}`],
    ['vencido', () => `Bearer ${tokenDe(ANDRES, '-1s')}`],
    ['basura', () => 'Bearer abc.def.ghi'],
  ])('401 si el token está %s', (_caso, header) => {
    const next = jest.fn() as NextFunction;
    const r = res();
    verifyAuth(SECRETO)(req(header()), r, next);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRol', () => {
  it('deja pasar al rol permitido y responde 403 a los demás', () => {
    const next = jest.fn() as NextFunction;
    requireRol('ADMIN')({ usuario: ADMIN } as Request, res(), next);
    expect(next).toHaveBeenCalledTimes(1);
    const r = res();
    requireRol('ADMIN')({ usuario: ANDRES } as Request, r, next);
    expect(r.status).toHaveBeenCalledWith(403);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
