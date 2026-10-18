import { unsubscribeController, outreachController } from './controller/outreach.controller';

/** Routes with a session, under /api/leads/:id/… */
export const OutreachRouter = outreachController;
/** Public unsubscribe link of the emails (no session), under /api/unsubscribe. */
export const UnsubscribeRouter = unsubscribeController;
