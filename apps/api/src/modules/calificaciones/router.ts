import { calificacionesLeadController, daptaController, daptaWebhookController } from './controller/calificaciones.controller';

/** Con sesión, bajo /api/leads/:id/… */
export const CalificacionesLeadRouter = calificacionesLeadController;
/** Con sesión, bajo /api/dapta (estado y envío en lote). */
export const DaptaRouter = daptaController;
/** Sin sesión (con secreto), en /api/dapta/webhook. */
export const DaptaWebhookRouter = daptaWebhookController;
