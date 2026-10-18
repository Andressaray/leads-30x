// Enlace de "no quiero recibir más mensajes": <leadId>.<firma>. La firma (HMAC con JWT_SECRET)
// impide que alguien dé de baja a otros leads cambiando el número. No caduca, a propósito.
import { createHmac, timingSafeEqual } from 'node:crypto';

const firma = (leadId: number, secreto: string) =>
  createHmac('sha256', secreto).update(`baja:${leadId}`).digest('base64url').slice(0, 24);

export function crearTokenBaja(leadId: number, secreto: string): string {
  return `${leadId}.${firma(leadId, secreto)}`;
}

/** El id del lead si el token es válido; null si no. */
export function leerTokenBaja(token: string, secreto: string): number | null {
  const m = /^(\d{1,10})\.([A-Za-z0-9_-]{24})$/.exec(token);
  if (!m) return null;
  const leadId = Number(m[1]);
  const esperada = Buffer.from(firma(leadId, secreto));
  const recibida = Buffer.from(m[2]);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida) ? leadId : null;
}
