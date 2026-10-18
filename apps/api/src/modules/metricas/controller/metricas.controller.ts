import { Router, type Request, type Response } from 'express';
import { matchedData } from 'express-validator';
import { AppError, HttpCode, handleError, handleSuccess, handleValidator } from '~response/index';
import { MetricasDomain } from '../domain/metricas.domain';
import { metricasValidator } from '../validator/metricas.validator';

const metricasDomain = new MetricasDomain();
export const metricasController = Router();

metricasController.get('/', [...metricasValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = matchedData(req, { locations: ['query'] });
    handleSuccess(res, HttpCode.OK, await metricasDomain.calcular({ desde: d.desde, hasta: d.hasta }));
  } catch (error: unknown) {
    if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
    else handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
  }
});
