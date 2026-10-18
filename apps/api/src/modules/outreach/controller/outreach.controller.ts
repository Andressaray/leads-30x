// Lead outreach (mounted under /api/leads, with a session) and the public unsubscribe link (/api/unsubscribe, no session).
import { Router, type Request, type Response } from 'express';
import { matchedData } from 'express-validator';
import { AppError, HttpCode, handleError, handleSuccess, handleValidator } from '~response/index';
import { OutreachDomain } from '../domain/outreach.domain';
import { unsubscribePage } from './unsubscribePage';
import {
  sendEmailValidator,
  idLeadValidator,
  doNotContactValidator,
  recordContactValidator,
  recordReplyValidator,
  unsubscribeTokenValidator,
  previewValidator,
} from '../validator/outreach.validator';

const outreachDomain = new OutreachDomain();
export const outreachController = Router();
export const unsubscribeController = Router();

function respondError(res: Response, error: unknown): void {
  if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
  else handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
}

const idOf = (req: Request): number => matchedData(req, { locations: ['params'] }).id;
const body = (req: Request) => matchedData(req, { locations: ['body'] });

outreachController.get('/:id/contact', [...idLeadValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await outreachDomain.sheet(idOf(req), req.user!));
  } catch (error: unknown) {
    respondError(res, error);
  }
});

outreachController.post('/:id/contact/preview', [...previewValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = body(req);
    const r = await outreachDomain.preview(idOf(req), { templateId: d.templateId, subject: d.subject, body: d.body }, req.user!);
    handleSuccess(res, HttpCode.OK, r);
  } catch (error: unknown) {
    respondError(res, error);
  }
});

outreachController.post('/:id/email', [...sendEmailValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = body(req);
    const r = await outreachDomain.sendEmail(idOf(req), { to: d.to, subject: d.subject, message: d.message, templateId: d.templateId }, req.user!);
    handleSuccess(res, HttpCode.CREATED, r);
  } catch (error: unknown) {
    respondError(res, error);
  }
});

outreachController.post('/:id/interactions', [...recordContactValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = body(req);
    const r = await outreachDomain.recordContact(
      idOf(req),
      { channel: d.channel, destination: d.destination, message: d.message, note: d.note, templateId: d.templateId },
      req.user!
    );
    handleSuccess(res, HttpCode.CREATED, r);
  } catch (error: unknown) {
    respondError(res, error);
  }
});

outreachController.post('/:id/reply', [...recordReplyValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = body(req);
    const r = await outreachDomain.recordReply(idOf(req), { channel: d.channel, result: d.result, note: d.note }, req.user!);
    handleSuccess(res, HttpCode.CREATED, r);
  } catch (error: unknown) {
    respondError(res, error);
  }
});

outreachController.post('/:id/do-not-contact', [...doNotContactValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await outreachDomain.markDoNotContact(idOf(req), body(req).note, req.user!));
  } catch (error: unknown) {
    respondError(res, error);
  }
});

// Link in the email. GET only shows the button (email antivirus scanners open links on their own);
// unsubscribing is done with POST: the page button or Gmail/Outlook's "Unsubscribe" (RFC 8058).
unsubscribeController.get('/:token', [...unsubscribeTokenValidator], (req: Request, res: Response) => {
  res.status(HttpCode.OK).type('html').send(unsubscribePage({ step: 'confirm', action: req.originalUrl }));
});

unsubscribeController.post('/:token', [...unsubscribeTokenValidator], async (req: Request, res: Response) => {
  try {
    const { token } = matchedData(req, { locations: ['params'] });
    const { name } = await outreachDomain.unsubscribe(token);
    res.status(HttpCode.OK).type('html').send(unsubscribePage({ step: 'ready', name }));
  } catch (error: unknown) {
    const status = error instanceof AppError ? error.status : HttpCode.INTERNAL_SERVER_ERROR;
    res.status(status).type('html').send(unsubscribePage({ step: 'error' }));
  }
});
