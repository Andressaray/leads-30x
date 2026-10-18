// Costs per channel: anyone with a session can see them; only an ADMIN records, changes or deletes them.
import { Router, type Request, type Response } from 'express';
import { matchedData } from 'express-validator';
import { requireRole } from 'middlewares/verifyAuth';
import { AppError, HttpCode, handleError, handleSuccess, handleValidator } from '~response/index';
import { CostsDomain } from '../domain/costs.domain';
import { updateCostValidator, createCostValidator, costIdValidator, listCostsValidator } from '../validator/costs.validator';

const costsDomain = new CostsDomain();
export const costsController = Router();

function respondError(res: Response, error: unknown): void {
  if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
  else handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
}

costsController.get('/', [...listCostsValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = matchedData(req, { locations: ['query'] });
    handleSuccess(res, HttpCode.OK, await costsDomain.list({ from: d.from, to: d.to }));
  } catch (error: unknown) {
    respondError(res, error);
  }
});

costsController.post('/', requireRole('ADMIN'), [...createCostValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = matchedData(req, { locations: ['body'] });
    const created = await costsDomain.create(
      { channel: d.channel, type: d.type ?? 'EXPENSE', description: d.description, amount: d.amount, hours: d.hours, hourlyRate: d.hourlyRate, from: d.from, to: d.to },
      req.user!
    );
    handleSuccess(res, HttpCode.CREATED, created);
  } catch (error: unknown) {
    respondError(res, error);
  }
});

costsController.patch('/:id', requireRole('ADMIN'), [...updateCostValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    handleSuccess(res, HttpCode.OK, await costsDomain.update(id, matchedData(req, { locations: ['body'] })));
  } catch (error: unknown) {
    respondError(res, error);
  }
});

costsController.delete('/:id', requireRole('ADMIN'), [...costIdValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    await costsDomain.remove(id);
    handleSuccess(res, HttpCode.OK, { id });
  } catch (error: unknown) {
    respondError(res, error);
  }
});
