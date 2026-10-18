import { Router, type Request, type Response } from 'express';
import { matchedData } from 'express-validator';
import { AppError, HttpCode, handleError, handleSuccess, handleValidator } from '~response/index';
import { BusquedasDomain } from '../domain/busquedas.domain';
import type { CrearBusquedaDTO } from '../types/busquedas.types';
import { crearBusquedaValidator, idBusquedaValidator, listarBusquedasValidator } from '../validator/busquedas.validator';

const busquedasDomain = new BusquedasDomain();
export const busquedasController = Router();

function responderError(res: Response, error: unknown): void {
  if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
  else handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
}

busquedasController.post('/', [...crearBusquedaValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { asincrona, ...payload } = matchedData(req, { locations: ['body'] }) as CrearBusquedaDTO & { asincrona?: boolean };
    if (asincrona) {
      // Responde ya; el cliente consulta GET /busquedas/:id hasta que deje de estar "en_curso".
      handleSuccess(res, HttpCode.ACCEPTED, await busquedasDomain.iniciar(payload));
      return;
    }
    handleSuccess(res, HttpCode.CREATED, await busquedasDomain.crear(payload));
  } catch (error: unknown) {
    responderError(res, error);
  }
});

busquedasController.get('/', [...listarBusquedasValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { limite } = matchedData(req, { locations: ['query'] });
    handleSuccess(res, HttpCode.OK, await busquedasDomain.listar(limite ?? 50));
  } catch (error: unknown) {
    responderError(res, error);
  }
});

busquedasController.get('/:id', [...idBusquedaValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    handleSuccess(res, HttpCode.OK, await busquedasDomain.obtener(id));
  } catch (error: unknown) {
    responderError(res, error);
  }
});
