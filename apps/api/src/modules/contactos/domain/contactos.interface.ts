import type { UsuarioSesion } from '~types/auth.types';
import type {
  EnviarCorreoDTO,
  FichaContactoDTO,
  LeadContactoDTO,
  MensajePreparadoDTO,
  RegistrarContactoDTO,
  RegistrarRespuestaDTO,
  ResultadoContactoDTO,
  VistaPreviaDTO,
} from '../types/contactos.types';

export interface ContactosDomainInterface {
  /** Estado, historial, datos por canal y si se puede contactar ahora (y por qué no). 404 si no existe. */
  ficha(leadId: number, usuario: UsuarioSesion): Promise<FichaContactoDTO>;
  /** Rellena una plantilla (o un texto) con los datos del lead. 400 si usa variables que no existen. */
  vistaPrevia(leadId: number, dto: VistaPreviaDTO, usuario: UsuarioSesion): Promise<MensajePreparadoDTO>;
  /**
   * Envía un correo al lead y lo registra. 409 si pidió no ser contactado, dijo que no le interesa
   * o lo trabaja otra persona; 422 si la Ley 2300 no lo permite ahora; 502 si el SMTP lo rechaza.
   */
  enviarCorreo(leadId: number, dto: EnviarCorreoDTO, usuario: UsuarioSesion): Promise<ResultadoContactoDTO>;
  /** Registra un WhatsApp, una llamada u otro contacto hecho fuera de la plataforma (mismas reglas). */
  registrarContacto(leadId: number, dto: RegistrarContactoDTO, usuario: UsuarioSesion): Promise<ResultadoContactoDTO>;
  /** Registra cómo respondió el lead. 409 si todavía no se había contactado o lo trabaja otra persona. */
  registrarRespuesta(leadId: number, dto: RegistrarRespuestaDTO, usuario: UsuarioSesion): Promise<ResultadoContactoDTO>;
  /** El lead pidió no ser contactado (por teléfono, WhatsApp…): bloquea todo envío. */
  marcarNoContactar(leadId: number, nota: string | undefined, usuario: UsuarioSesion): Promise<LeadContactoDTO>;
  /** Enlace público de baja de los correos. 404 si el enlace no es válido. */
  darseDeBaja(token: string): Promise<{ nombre: string }>;
  /** Para otros módulos: lanza 404/409/422 si no se puede contactar al lead por ese canal ahora. */
  exigirPermisoContacto(leadId: number, usuario: UsuarioSesion, canal: 'EMAIL' | 'WHATSAPP' | 'LLAMADA'): Promise<LeadContactoDTO>;
  /** Para otros módulos: una llamada que hizo un sistema externo (agente de Dapta) en nombre del usuario. */
  registrarLlamadaExterna(leadId: number, usuario: UsuarioSesion, nota: string): Promise<void>;
  /** Para otros módulos: el lead respondió a un sistema externo. Solo avanza el embudo. */
  registrarRespuestaExterna(leadId: number, resultado: 'RESPONDIO' | 'INTERESADO', nota: string): Promise<void>;
}
