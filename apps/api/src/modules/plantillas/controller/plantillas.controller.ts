import { Router, type Request, type Response } from 'express';
import { matchedData } from 'express-validator';
import { AppError, HttpCode, handleError, handleSuccess, handleValidator } from '~response/index';
import { PlantillasDomain } from '../domain/plantillas.domain';
import { VARIABLES } from '../domain/plantillas.render';
import {
  actualizarPlantillaValidator,
  crearPlantillaValidator,
  idPlantillaValidator,
  listarPlantillasValidator,
} from '../validator/plantillas.validator';

const plantillasDomain = new PlantillasDomain();
export const plantillasController = Router();

function responderError(res: Response, error: unknown): void {
  if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
  else handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
}

plantillasController.get('/variables', (_req: Request, res: Response) => {
  handleSuccess(res, HttpCode.OK, Object.entries(VARIABLES).map(([nombre, descripcion]) => ({ nombre, descripcion })));
});

plantillasController.get('/', [...listarPlantillasValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = matchedData(req, { locations: ['query'] });
    handleSuccess(res, HttpCode.OK, await plantillasDomain.listar({ canal: d.canal, incluirInactivas: d.inactivas }));
  } catch (error: unknown) {
    responderError(res, error);
  }
});

plantillasController.get('/:id', [...idPlantillaValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    handleSuccess(res, HttpCode.OK, await plantillasDomain.obtener(id));
  } catch (error: unknown) {
    responderError(res, error);
  }
});

plantillasController.post('/', [...crearPlantillaValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const d = matchedData(req, { locations: ['body'] });
    const creada = await plantillasDomain.crear({ nombre: d.nombre, canal: d.canal, asunto: d.asunto ?? null, cuerpo: d.cuerpo }, req.usuario!);
    handleSuccess(res, HttpCode.CREATED, creada);
  } catch (error: unknown) {
    responderError(res, error);
  }
});

plantillasController.patch('/:id', [...actualizarPlantillaValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    const d = matchedData(req, { locations: ['body'] });
    handleSuccess(res, HttpCode.OK, await plantillasDomain.actualizar(id, d, req.usuario!));
  } catch (error: unknown) {
    responderError(res, error);
  }
});
