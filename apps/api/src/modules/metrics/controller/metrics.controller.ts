import { Router, type Request, type Response } from 'express';
import { matchedData } from 'express-validator';
import { AppError, HttpCode, handleError, handleSuccess, handleValidator } from '~response/index';
import { MetricsDomain } from '../domain/metrics.domain';
import { metricsValidator } from '../validator/metrics.validator';

const metricsDomain = new MetricsDomain();
export const metricsController = Router();

metricsController.get('/', [...metricsValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = matchedData(req, { locations: ['query'] });
    handleSuccess(res, HttpCode.OK, await metricsDomain.calculate({ from: d.from, to: d.to }));
  } catch (error: unknown) {
    if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
    else handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
  }
});
