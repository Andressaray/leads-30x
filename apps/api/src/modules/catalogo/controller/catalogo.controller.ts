import { Router, type Request, type Response } from 'express';
import { matchedData } from 'express-validator';
import { AppError, HttpCode, handleError, handleSuccess, handleValidator } from '~response/index';
import { CatalogoDomain } from '../domain/catalogo.domain';
import { municipiosValidator } from '../validator/catalogo.validator';

const catalogoDomain = new CatalogoDomain();
export const catalogoController = Router();

function responderError(res: Response, error: unknown): void {
  if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
  else handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
}

catalogoController.get('/categorias', async (_req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await catalogoDomain.categorias());
  } catch (error: unknown) {
    responderError(res, error);
  }
});

catalogoController.get('/departamentos', async (_req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await catalogoDomain.departamentos());
  } catch (error: unknown) {
    responderError(res, error);
  }
});

catalogoController.get('/municipios', [...municipiosValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = matchedData(req, { locations: ['query'] });
    handleSuccess(res, HttpCode.OK, await catalogoDomain.municipios({ q: d.q ?? '', codDpto: d.departamento ?? null, limite: d.limite ?? 50 }));
  } catch (error: unknown) {
    responderError(res, error);
  }
});

catalogoController.get('/fuentes', async (_req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await catalogoDomain.fuentes());
  } catch (error: unknown) {
    responderError(res, error);
  }
});
