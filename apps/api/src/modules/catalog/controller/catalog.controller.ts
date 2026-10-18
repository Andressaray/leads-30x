import { Router, type Request, type Response } from 'express';
import { matchedData } from 'express-validator';
import { AppError, HttpCode, handleError, handleSuccess, handleValidator } from '~response/index';
import { CatalogDomain } from '../domain/catalog.domain';
import { municipalitiesValidator } from '../validator/catalog.validator';

const catalogDomain = new CatalogDomain();
export const catalogController = Router();

function respondError(res: Response, error: unknown): void {
  if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
  else handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
}

catalogController.get('/categories', async (_req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await catalogDomain.categories());
  } catch (error: unknown) {
    respondError(res, error);
  }
});

catalogController.get('/departments', async (_req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await catalogDomain.departments());
  } catch (error: unknown) {
    respondError(res, error);
  }
});

catalogController.get('/municipalities', [...municipalitiesValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = matchedData(req, { locations: ['query'] });
    handleSuccess(res, HttpCode.OK, await catalogDomain.municipalities({ q: d.q ?? '', departmentCode: d.department ?? null, limit: d.limit ?? 50 }));
  } catch (error: unknown) {
    respondError(res, error);
  }
});

catalogController.get('/sources', async (_req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await catalogDomain.sources());
  } catch (error: unknown) {
    respondError(res, error);
  }
});
