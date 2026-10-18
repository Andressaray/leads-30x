// "I do not want more messages" link: <leadId>.<signature>. The signature (HMAC with JWT_SECRET)
// prevents someone from unsubscribing other leads by changing the number. It does not expire, on purpose.
import { createHmac, timingSafeEqual } from 'node:crypto';

const signature = (leadId: number, secret: string) =>
  createHmac('sha256', secret).update(`baja:${leadId}`).digest('base64url').slice(0, 24);

export function createUnsubscribeToken(leadId: number, secret: string): string {
  return `${leadId}.${signature(leadId, secret)}`;
}

/** The lead id if the token is valid; null otherwise. */
export function readUnsubscribeToken(token: string, secret: string): number | null {
  const m = /^(\d{1,10})\.([A-Za-z0-9_-]{24})$/.exec(token);
  if (!m) return null;
  const leadId = Number(m[1]);
  const expected = Buffer.from(signature(leadId, secret));
  const received = Buffer.from(m[2]);
  return expected.length === received.length && timingSafeEqual(expected, received) ? leadId : null;
}
