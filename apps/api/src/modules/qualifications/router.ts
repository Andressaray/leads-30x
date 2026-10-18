import { leadQualificationsController, daptaController, daptaWebhookController } from './controller/qualifications.controller';

/** With a session, under /api/leads/:id/… */
export const LeadQualificationsRouter = leadQualificationsController;
/** With a session, under /api/dapta (status and batch dispatch). */
export const DaptaRouter = daptaController;
/** No session (with a secret), at /api/dapta/webhook. */
export const DaptaWebhookRouter = daptaWebhookController;
