import { Router, type Request, type Response } from 'express';
import { matchedData } from 'express-validator';
import { AppError, HttpCode, handleError, handleSuccess, handleValidator } from '~response/index';
import { SearchesDomain } from '../domain/searches.domain';
import type { CreateSearchRequestDTO } from '../types/searches.types';
import { createSearchValidator, searchIdValidator, listSearchesValidator } from '../validator/searches.validator';

const searchesDomain = new SearchesDomain();
export const searchesController = Router();

function respondError(res: Response, error: unknown): void {
  if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
  else handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
}

searchesController.post('/', [...createSearchValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { async: inBackground, ...payload } = matchedData(req, { locations: ['body'] }) as CreateSearchRequestDTO & { async?: boolean };
    if (inBackground) {
      // Respond right away; the client polls GET /searches/:id until it is no longer "in_progress".
      handleSuccess(res, HttpCode.ACCEPTED, await searchesDomain.start(payload));
      return;
    }
    handleSuccess(res, HttpCode.CREATED, await searchesDomain.create(payload));
  } catch (error: unknown) {
    respondError(res, error);
  }
});

searchesController.get('/', [...listSearchesValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { limit } = matchedData(req, { locations: ['query'] });
    handleSuccess(res, HttpCode.OK, await searchesDomain.list(limit ?? 50));
  } catch (error: unknown) {
    respondError(res, error);
  }
});

searchesController.get('/:id', [...searchIdValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    handleSuccess(res, HttpCode.OK, await searchesDomain.get(id));
  } catch (error: unknown) {
    respondError(res, error);
  }
});
