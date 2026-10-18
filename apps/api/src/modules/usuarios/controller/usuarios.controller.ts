// Usuarios: la lista completa es solo para ADMIN; la de miembros del equipo la ve cualquiera con sesión.
import { Router, type Request, type Response } from 'express';
import { AppError, HttpCode, handleError, handleSuccess } from '~response/index';
import { requireRol } from 'middlewares/verifyAuth';
import { AuthDomain } from 'modules/auth/domain/auth.domain';

const authDomain = new AuthDomain();
export const usuariosController = Router();

function responderError(res: Response, error: unknown): void {
  if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
  else handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
}

// Miembros del equipo (sin administradores) para el filtro de "Contactados".
usuariosController.get('/miembros', async (_req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await authDomain.listarMiembros());
  } catch (error: unknown) {
    responderError(res, error);
  }
});

usuariosController.get('/', requireRol('ADMIN'), async (_req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await authDomain.listarUsuarios());
  } catch (error: unknown) {
    responderError(res, error);
  }
});
