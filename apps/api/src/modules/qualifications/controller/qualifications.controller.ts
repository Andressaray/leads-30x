// Qualification with Dapta: per-lead routes (/api/leads/:id/…), batch dispatch and status (/api/dapta/…, with
// a session) and the results webhook (/api/dapta/webhook, no session but with a secret).
import { Router, type Request, type Response } from 'express';
import { matchedData } from 'express-validator';
import { logger } from '~config/logger';
import { AppError, HttpCode, handleError, handleSuccess, handleValidator } from '~response/index';
import { QualificationsDomain } from '../domain/qualifications.domain';
import { qualifyManuallyValidator, idLeadValidator, batchValidator } from '../validator/qualifications.validator';

const qualificationsDomain = new QualificationsDomain();
export const leadQualificationsController = Router();
export const daptaController = Router();
export const daptaWebhookController = Router();

function respondError(res: Response, error: unknown): void {
  if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
  else {
    logger.error({ err: error }, 'Unexpected error in qualifications/Dapta');
    handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
  }
}

const idOf = (req: Request): number => matchedData(req, { locations: ['params'] }).id;

leadQualificationsController.get('/:id/qualifications', [...idLeadValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await qualificationsDomain.list(idOf(req)));
  } catch (error: unknown) {
    respondError(res, error);
  }
});

leadQualificationsController.post('/:id/dapta', [...idLeadValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.CREATED, await qualificationsDomain.send(idOf(req), req.user!));
  } catch (error: unknown) {
    respondError(res, error);
  }
});

leadQualificationsController.post('/:id/qualification', [...qualifyManuallyValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = matchedData(req, { locations: ['body'] });
    const r = await qualificationsDomain.qualifyManually(idOf(req), { quality: d.quality, score: d.score, note: d.note }, req.user!);
    handleSuccess(res, HttpCode.CREATED, r);
  } catch (error: unknown) {
    respondError(res, error);
  }
});

daptaController.get('/status', (_req: Request, res: Response) => {
  handleSuccess(res, HttpCode.OK, qualificationsDomain.status());
});

daptaController.post('/dispatches', [...batchValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { leadIds } = matchedData(req, { locations: ['body'] });
    handleSuccess(res, HttpCode.OK, await qualificationsDomain.sendBatch(leadIds, req.user!));
  } catch (error: unknown) {
    respondError(res, error);
  }
});

// The Dapta flow sends the secret in the x-dapta-secret header (or Authorization: Bearer) or, if
// its HTTP node does not allow headers, in the URL (?token=…).
daptaWebhookController.post('/', async (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    const secret =
      (req.headers['x-dapta-secret'] as string | undefined) ??
      (auth?.startsWith('Bearer ') ? auth.slice(7).trim() : undefined) ??
      (typeof req.query.token === 'string' ? req.query.token : undefined);
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {};
    const r = await qualificationsDomain.receiveResult(body, secret);
    handleSuccess(res, HttpCode.OK, { id: r.id, leadId: r.leadId, status: r.status, quality: r.quality, score: r.score });
  } catch (error: unknown) {
    respondError(res, error);
  }
});
