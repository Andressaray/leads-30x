// Calificación con Dapta: rutas por lead (/api/leads/:id/…), envío en lote y estado (/api/dapta/…, con
// sesión) y el webhook de resultados (/api/dapta/webhook, sin sesión pero con secreto).
import { Router, type Request, type Response } from 'express';
import { matchedData } from 'express-validator';
import { logger } from '~config/logger';
import { AppError, HttpCode, handleError, handleSuccess, handleValidator } from '~response/index';
import { CalificacionesDomain } from '../domain/calificaciones.domain';
import { calificarManualValidator, idLeadValidator, loteValidator } from '../validator/calificaciones.validator';

const calificacionesDomain = new CalificacionesDomain();
export const calificacionesLeadController = Router();
export const daptaController = Router();
export const daptaWebhookController = Router();

function responderError(res: Response, error: unknown): void {
  if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
  else {
    logger.error({ err: error }, 'Error inesperado en calificaciones/Dapta');
    handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
  }
}

const idDe = (req: Request): number => matchedData(req, { locations: ['params'] }).id;

calificacionesLeadController.get('/:id/calificaciones', [...idLeadValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await calificacionesDomain.listar(idDe(req)));
  } catch (error: unknown) {
    responderError(res, error);
  }
});

calificacionesLeadController.post('/:id/dapta', [...idLeadValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.CREATED, await calificacionesDomain.enviar(idDe(req), req.usuario!));
  } catch (error: unknown) {
    responderError(res, error);
  }
});

calificacionesLeadController.post('/:id/calificacion', [...calificarManualValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = matchedData(req, { locations: ['body'] });
    const r = await calificacionesDomain.calificarManual(idDe(req), { calidad: d.calidad, puntaje: d.puntaje, nota: d.nota }, req.usuario!);
    handleSuccess(res, HttpCode.CREATED, r);
  } catch (error: unknown) {
    responderError(res, error);
  }
});

daptaController.get('/estado', (_req: Request, res: Response) => {
  handleSuccess(res, HttpCode.OK, calificacionesDomain.estado());
});

daptaController.post('/envios', [...loteValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { leadIds } = matchedData(req, { locations: ['body'] });
    handleSuccess(res, HttpCode.OK, await calificacionesDomain.enviarLote(leadIds, req.usuario!));
  } catch (error: unknown) {
    responderError(res, error);
  }
});

// El flujo de Dapta manda el secreto en la cabecera x-dapta-secret (o Authorization: Bearer) o, si
// su nodo HTTP no permite cabeceras, en la URL (?token=…).
daptaWebhookController.post('/', async (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    const secreto =
      (req.headers['x-dapta-secret'] as string | undefined) ??
      (auth?.startsWith('Bearer ') ? auth.slice(7).trim() : undefined) ??
      (typeof req.query.token === 'string' ? req.query.token : undefined);
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {};
    const r = await calificacionesDomain.recibirResultado(body, secreto);
    handleSuccess(res, HttpCode.OK, { id: r.id, leadId: r.leadId, estado: r.estado, calidad: r.calidad, puntaje: r.puntaje });
  } catch (error: unknown) {
    responderError(res, error);
  }
});
