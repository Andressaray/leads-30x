import type { Response } from 'express';
import { handleError, handleFile, handleSuccess, HttpCode } from '~response/index';

function res() {
  const r = { status: jest.fn(), json: jest.fn(), send: jest.fn(), setHeader: jest.fn() };
  r.status.mockReturnValue(r);
  return r as unknown as Response & Record<'status' | 'json' | 'send' | 'setHeader', jest.Mock>;
}

describe('helpers de respuesta', () => {
  it('handleSuccess → { data, status }', () => {
    const r = res();
    handleSuccess(r, HttpCode.CREATED, { id: 1 });
    expect(r.status).toHaveBeenCalledWith(201);
    expect(r.json).toHaveBeenCalledWith({ data: { id: 1 }, status: 201 });
  });

  it('handleError → { error, status } y details solo si existe', () => {
    const r = res();
    handleError(r, HttpCode.BAD_REQUEST, 'mal');
    expect(r.json).toHaveBeenCalledWith({ error: 'mal', status: 400 });
    handleError(r, HttpCode.CONFLICT, 'choque', { x: 1 });
    expect(r.json).toHaveBeenLastCalledWith({ error: 'choque', status: 409, details: { x: 1 } });
  });

  it('handleFile pone encabezados de descarga', () => {
    const r = res();
    handleFile(r, 'a.csv', 'text/csv', 'x');
    expect(r.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="a.csv"');
    expect(r.send).toHaveBeenCalledWith('x');
  });
});
