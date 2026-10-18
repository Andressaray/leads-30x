// Cliente de Dapta: le entrega un lead a un flujo de Flow Studio por su "Public Route"
// (la autenticación va en la URL, así lo documenta Dapta). El flujo decide qué hacer
// (normalmente llamar al lead con un agente de voz) y devuelve la calificación a nuestro
// webhook POST /api/dapta/webhook.
//
// Sin DAPTA_FLOW_URL: en desarrollo los envíos se "simulan" (se registran, no salen);
// en producción fallan con un error claro.

import { environment } from '~config/environment';
import { logger } from '~config/logger';

export type ModoDapta = 'activo' | 'simulado' | 'desactivado';

/** Lo que recibe el flujo de Dapta (mapéalo en el nodo "Dapta Phone Call" o en el que uses). */
export interface EnvioDapta {
  /** Debe volver igual en el webhook para cruzar el resultado. */
  referencia: string;
  lead_id: number;
  /** Variables con los nombres que usan los ejemplos de Dapta. */
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  municipio: string;
  departamento: string;
  categoria: string | null;
  fuente: string;
  estado_contacto: string;
  /** A dónde el flujo debe mandar el resultado (vacío si no hay URL_PUBLICA). */
  callback_url: string | null;
}

export class ErrorEnvioDapta extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErrorEnvioDapta';
  }
}

export function modoDapta(): ModoDapta {
  if (environment.dapta.flowUrl) return 'activo';
  return environment.nodeEnv === 'production' ? 'desactivado' : 'simulado';
}

export async function enviarADapta(envio: EnvioDapta): Promise<{ estado: 'ENVIADO' | 'SIMULADO' }> {
  const modo = modoDapta();
  if (modo === 'desactivado') throw new ErrorEnvioDapta('La integración con Dapta no está configurada (falta DAPTA_FLOW_URL).');
  if (modo === 'simulado') {
    logger.info({ lead: envio.lead_id, referencia: envio.referencia }, 'Envío a Dapta simulado (sin DAPTA_FLOW_URL)');
    return { estado: 'SIMULADO' };
  }
  let res: Response;
  try {
    res = await fetch(environment.dapta.flowUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': environment.userAgent },
      body: JSON.stringify(envio),
      signal: AbortSignal.timeout(environment.dapta.timeoutMs),
    });
  } catch (err) {
    const msg = err instanceof Error ? (err.name === 'TimeoutError' ? 'Dapta no respondió a tiempo.' : err.message) : String(err);
    throw new ErrorEnvioDapta(`No se pudo conectar con Dapta: ${msg}`);
  }
  if (!res.ok) {
    const texto = (await res.text().catch(() => '')).slice(0, 200);
    throw new ErrorEnvioDapta(`Dapta respondió ${res.status}${texto ? `: ${texto}` : ''}.`);
  }
  return { estado: 'ENVIADO' };
}
