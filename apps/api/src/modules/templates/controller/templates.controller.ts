import { Router, type Request, type Response } from 'express';
import { matchedData } from 'express-validator';
import { AppError, HttpCode, handleError, handleSuccess, handleValidator } from '~response/index';
import { TemplatesDomain } from '../domain/templates.domain';
import { PLACEHOLDERS, VARIABLES } from '../domain/templates.render';
import {
  updateTemplateValidator,
  createTemplateValidator,
  templateIdValidator,
  listTemplatesValidator,
} from '../validator/templates.validator';

const templatesDomain = new TemplatesDomain();
export const templatesController = Router();

function respondError(res: Response, error: unknown): void {
  if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
  else handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
}

templatesController.get('/variables', (_req: Request, res: Response) => {
  handleSuccess(res, HttpCode.OK, (Object.keys(VARIABLES) as (keyof typeof VARIABLES)[]).map((field) => ({ name: PLACEHOLDERS[field], description: VARIABLES[field] })));
});

templatesController.get('/', [...listTemplatesValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = matchedData(req, { locations: ['query'] });
    handleSuccess(res, HttpCode.OK, await templatesDomain.list({ channel: d.channel, includeInactive: d.inactive }));
  } catch (error: unknown) {
    respondError(res, error);
  }
});

templatesController.get('/:id', [...templateIdValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    handleSuccess(res, HttpCode.OK, await templatesDomain.get(id));
  } catch (error: unknown) {
    respondError(res, error);
  }
});

templatesController.post('/', [...createTemplateValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = matchedData(req, { locations: ['body'] });
    const created = await templatesDomain.create({ name: d.name, channel: d.channel, subject: d.subject ?? null, body: d.body }, req.user!);
    handleSuccess(res, HttpCode.CREATED, created);
  } catch (error: unknown) {
    respondError(res, error);
  }
});

templatesController.patch('/:id', [...updateTemplateValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    const d = matchedData(req, { locations: ['body'] });
    handleSuccess(res, HttpCode.OK, await templatesDomain.update(id, d, req.user!));
  } catch (error: unknown) {
    respondError(res, error);
  }
});
