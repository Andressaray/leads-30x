// Users: the full list is ADMIN only; the team members list is visible to anyone with a session.
import { Router, type Request, type Response } from 'express';
import { AppError, HttpCode, handleError, handleSuccess } from '~response/index';
import { requireRole } from 'middlewares/verifyAuth';
import { AuthDomain } from 'modules/auth/domain/auth.domain';

const authDomain = new AuthDomain();
export const usersController = Router();

function respondError(res: Response, error: unknown): void {
  if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
  else handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
}

// Team members (no administrators) for the "Contacted" filter.
usersController.get('/members', async (_req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await authDomain.listMembers());
  } catch (error: unknown) {
    respondError(res, error);
  }
});

usersController.get('/', requireRole('ADMIN'), async (_req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await authDomain.listUsers());
  } catch (error: unknown) {
    respondError(res, error);
  }
});
