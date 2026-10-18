import { Router, type Request, type Response } from 'express';
import { matchedData } from 'express-validator';
import { environment } from '~config/environment';
import { AppError, HttpCode, handleError, handleSuccess, handleValidator } from '~response/index';
import { verifyAuth } from 'middlewares/verifyAuth';
import { AuthDomain } from '../domain/auth.domain';
import type { LoginDTO } from '../types/auth.types';
import { loginValidator } from '../validator/auth.validator';

const authDomain = new AuthDomain();
export const authController = Router();

function responderError(res: Response, error: unknown): void {
  if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
  else handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
}

authController.post('/login', [...loginValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const datos = matchedData(req, { locations: ['body'] }) as LoginDTO;
    handleSuccess(res, HttpCode.OK, await authDomain.login(datos));
  } catch (error: unknown) {
    responderError(res, error);
  }
});

authController.get('/me', verifyAuth(environment.jwtSecret), async (req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await authDomain.yo(req.usuario!));
  } catch (error: unknown) {
    responderError(res, error);
  }
});
