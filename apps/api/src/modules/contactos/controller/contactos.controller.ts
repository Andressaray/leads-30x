// Contacto con leads (montado bajo /api/leads, con sesión) y enlace público de baja (/api/bajas, sin sesión).
import { Router, type Request, type Response } from 'express';
import { matchedData } from 'express-validator';
import { AppError, HttpCode, handleError, handleSuccess, handleValidator } from '~response/index';
import { ContactosDomain } from '../domain/contactos.domain';
import { paginaBaja } from './paginaBaja';
import {
  enviarCorreoValidator,
  idLeadValidator,
  noContactarValidator,
  registrarContactoValidator,
  registrarRespuestaValidator,
  tokenBajaValidator,
  vistaPreviaValidator,
} from '../validator/contactos.validator';

const contactosDomain = new ContactosDomain();
export const contactosController = Router();
export const bajasController = Router();

function responderError(res: Response, error: unknown): void {
  if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
  else handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
}

const idDe = (req: Request): number => matchedData(req, { locations: ['params'] }).id;
const cuerpo = (req: Request) => matchedData(req, { locations: ['body'] });

contactosController.get('/:id/contacto', [...idLeadValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await contactosDomain.ficha(idDe(req), req.usuario!));
  } catch (error: unknown) {
    responderError(res, error);
  }
});

contactosController.post('/:id/contacto/vista-previa', [...vistaPreviaValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = cuerpo(req);
    const r = await contactosDomain.vistaPrevia(idDe(req), { plantillaId: d.plantillaId, asunto: d.asunto, cuerpo: d.cuerpo }, req.usuario!);
    handleSuccess(res, HttpCode.OK, r);
  } catch (error: unknown) {
    responderError(res, error);
  }
});

contactosController.post('/:id/correo', [...enviarCorreoValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = cuerpo(req);
    const r = await contactosDomain.enviarCorreo(idDe(req), { para: d.para, asunto: d.asunto, mensaje: d.mensaje, plantillaId: d.plantillaId }, req.usuario!);
    handleSuccess(res, HttpCode.CREATED, r);
  } catch (error: unknown) {
    responderError(res, error);
  }
});

contactosController.post('/:id/interacciones', [...registrarContactoValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = cuerpo(req);
    const r = await contactosDomain.registrarContacto(
      idDe(req),
      { canal: d.canal, destino: d.destino, mensaje: d.mensaje, nota: d.nota, plantillaId: d.plantillaId },
      req.usuario!
    );
    handleSuccess(res, HttpCode.CREATED, r);
  } catch (error: unknown) {
    responderError(res, error);
  }
});

contactosController.post('/:id/respuesta', [...registrarRespuestaValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = cuerpo(req);
    const r = await contactosDomain.registrarRespuesta(idDe(req), { canal: d.canal, resultado: d.resultado, nota: d.nota }, req.usuario!);
    handleSuccess(res, HttpCode.CREATED, r);
  } catch (error: unknown) {
    responderError(res, error);
  }
});

contactosController.post('/:id/no-contactar', [...noContactarValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await contactosDomain.marcarNoContactar(idDe(req), cuerpo(req).nota, req.usuario!));
  } catch (error: unknown) {
    responderError(res, error);
  }
});

// Enlace del correo. GET solo muestra el botón (los antivirus de correo abren los enlaces solos);
// la baja se hace con POST: el botón de la página o el "Cancelar suscripción" de Gmail/Outlook (RFC 8058).
bajasController.get('/:token', [...tokenBajaValidator], (req: Request, res: Response) => {
  res.status(HttpCode.OK).type('html').send(paginaBaja({ paso: 'confirmar', accion: req.originalUrl }));
});

bajasController.post('/:token', [...tokenBajaValidator], async (req: Request, res: Response) => {
  try {
    const { token } = matchedData(req, { locations: ['params'] });
    const { nombre } = await contactosDomain.darseDeBaja(token);
    res.status(HttpCode.OK).type('html').send(paginaBaja({ paso: 'listo', nombre }));
  } catch (error: unknown) {
    const status = error instanceof AppError ? error.status : HttpCode.INTERNAL_SERVER_ERROR;
    res.status(status).type('html').send(paginaBaja({ paso: 'error' }));
  }
});
