// Dapta client: hands a lead to a Flow Studio flow through its "Public Route"
// (authentication goes in the URL, as Dapta documents it). The flow decides what to do
// (usually calling the lead with a voice agent) and returns the qualification to our
// webhook POST /api/dapta/webhook.
//
// Without DAPTA_FLOW_URL: in development dispatches are "simulated" (recorded, not sent);
// in production they fail with a clear error.

import { environment } from '~config/environment';
import { logger } from '~config/logger';

export type DaptaMode = 'active' | 'simulated' | 'disabled';

/** What the Dapta flow receives (map it in the "Dapta Phone Call" node or whichever you use). */
export interface DaptaDispatch {
  /** Must come back unchanged in the webhook to match the result. */
  reference: string;
  lead_id: number;
  /** Variables with the names used in Dapta's examples. */
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  municipality: string;
  department: string;
  category: string | null;
  source: string;
  contact_status: string;
  /** Where the flow must send the result (empty if there is no PUBLIC_URL). */
  callback_url: string | null;
}

export class DaptaSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DaptaSendError';
  }
}

export function daptaMode(): DaptaMode {
  if (environment.dapta.flowUrl) return 'active';
  return environment.nodeEnv === 'production' ? 'disabled' : 'simulated';
}

export async function sendToDapta(dispatch: DaptaDispatch): Promise<{ status: 'SENT' | 'SIMULATED' }> {
  const mode = daptaMode();
  if (mode === 'disabled') throw new DaptaSendError('La integración con Dapta no está configurada (falta DAPTA_FLOW_URL).');
  if (mode === 'simulated') {
    logger.info({ lead: dispatch.lead_id, reference: dispatch.reference }, 'Simulated Dapta dispatch (no DAPTA_FLOW_URL)');
    return { status: 'SIMULATED' };
  }
  let res: Response;
  try {
    res = await fetch(environment.dapta.flowUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': environment.userAgent },
      body: JSON.stringify(dispatch),
      signal: AbortSignal.timeout(environment.dapta.timeoutMs),
    });
  } catch (err) {
    const msg = err instanceof Error ? (err.name === 'TimeoutError' ? 'Dapta no respondió a tiempo.' : err.message) : String(err);
    throw new DaptaSendError(`No se pudo conectar con Dapta: ${msg}`);
  }
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 200);
    throw new DaptaSendError(`Dapta respondió ${res.status}${text ? `: ${text}` : ''}.`);
  }
  return { status: 'SENT' };
}
