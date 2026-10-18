// Envío de correo por SMTP (sirve cualquier proveedor: Gmail/Workspace, Brevo, Amazon SES, Mailgun…).
// Sin SMTP_HOST:
//   - en desarrollo y pruebas los correos se "simulan": no salen, pero quedan registrados;
//   - en producción el envío falla con un error claro (no se marca nada como enviado).

import nodemailer, { type Transporter } from 'nodemailer';
import { environment } from '~config/environment';
import { logger } from '~config/logger';

export type ModoCorreo = 'smtp' | 'simulado' | 'desactivado';

export interface CorreoSaliente {
  para: string;
  asunto: string;
  texto: string;
  /** Respuestas a este correo (ej. el correo del vendedor). */
  responderA?: string;
  /** Enlace de baja de un clic (RFC 8058): Gmail y Outlook muestran "Cancelar suscripción". */
  urlBaja?: string;
}

export interface ResultadoEnvio {
  estado: 'ENVIADO' | 'SIMULADO';
  proveedorId: string | null;
}

/** Error del servidor de correo (rechazó el destinatario, credenciales malas, sin conexión…). */
export class ErrorEnvioCorreo extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErrorEnvioCorreo';
  }
}

export function modoCorreo(): ModoCorreo {
  if (environment.correo.host) return 'smtp';
  return environment.nodeEnv === 'production' ? 'desactivado' : 'simulado';
}

let transporte: Transporter | null = null;

function obtenerTransporte(): Transporter {
  if (transporte) return transporte;
  const c = environment.correo;
  transporte = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    ...(c.user ? { auth: { user: c.user, pass: c.pass } } : {}),
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  return transporte;
}

function remitente(): string {
  const c = environment.correo;
  return c.remitente ?? (c.user ? `${environment.nombreEmpresa} <${c.user}>` : `${environment.nombreEmpresa} <no-responder@localhost>`);
}

export async function enviarCorreo(correo: CorreoSaliente): Promise<ResultadoEnvio> {
  const modo = modoCorreo();
  if (modo === 'desactivado') {
    throw new ErrorEnvioCorreo('El envío de correo no está configurado en el servidor (falta SMTP_HOST).');
  }
  if (modo === 'simulado') {
    logger.info({ para: correo.para, asunto: correo.asunto }, 'Correo simulado (sin SMTP_HOST): no se envió');
    return { estado: 'SIMULADO', proveedorId: null };
  }
  try {
    const info = await obtenerTransporte().sendMail({
      from: remitente(),
      to: correo.para,
      subject: correo.asunto,
      text: correo.texto,
      ...(correo.responderA ? { replyTo: correo.responderA } : {}),
      ...(correo.urlBaja
        ? { headers: { 'List-Unsubscribe': `<${correo.urlBaja}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
        : {}),
    });
    if (info.rejected?.length) throw new ErrorEnvioCorreo(`El servidor de correo rechazó a ${correo.para}.`);
    return { estado: 'ENVIADO', proveedorId: info.messageId ?? null };
  } catch (err) {
    if (err instanceof ErrorEnvioCorreo) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ para: correo.para, err: msg }, 'No se pudo enviar el correo');
    throw new ErrorEnvioCorreo(`El servidor de correo no aceptó el mensaje: ${msg}`);
  }
}

/** Solo para pruebas: olvida el transporte para que tome la configuración nueva. */
export function _reiniciarTransporte(): void {
  transporte = null;
}
