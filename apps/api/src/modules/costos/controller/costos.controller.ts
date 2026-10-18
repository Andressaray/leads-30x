// Costos por canal: cualquiera con sesión los ve; solo un ADMIN los registra, cambia o borra.
import { Router, type Request, type Response } from 'express';
import { matchedData } from 'express-validator';
import { requireRol } from 'middlewares/verifyAuth';
import { AppError, HttpCode, handleError, handleSuccess, handleValidator } from '~response/index';
import { CostosDomain } from '../domain/costos.domain';
import { actualizarCostoValidator, crearCostoValidator, idCostoValidator, listarCostosValidator } from '../validator/costos.validator';

const costosDomain = new CostosDomain();
export const costosController = Router();

function responderError(res: Response, error: unknown): void {
  if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
  else handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
}

costosController.get('/', [...listarCostosValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = matchedData(req, { locations: ['query'] });
    handleSuccess(res, HttpCode.OK, await costosDomain.listar({ desde: d.desde, hasta: d.hasta }));
  } catch (error: unknown) {
    responderError(res, error);
  }
});

costosController.post('/', requireRol('ADMIN'), [...crearCostoValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = matchedData(req, { locations: ['body'] });
    const creado = await costosDomain.crear(
      { canal: d.canal, tipo: d.tipo ?? 'GASTO', descripcion: d.descripcion, monto: d.monto, horas: d.horas, valorHora: d.valorHora, desde: d.desde, hasta: d.hasta },
      req.usuario!
    );
    handleSuccess(res, HttpCode.CREATED, creado);
  } catch (error: unknown) {
    responderError(res, error);
  }
});

costosController.patch('/:id', requireRol('ADMIN'), [...actualizarCostoValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    handleSuccess(res, HttpCode.OK, await costosDomain.actualizar(id, matchedData(req, { locations: ['body'] })));
  } catch (error: unknown) {
    responderError(res, error);
  }
});

costosController.delete('/:id', requireRol('ADMIN'), [...idCostoValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    await costosDomain.eliminar(id);
    handleSuccess(res, HttpCode.OK, { id });
  } catch (error: unknown) {
    responderError(res, error);
  }
});
