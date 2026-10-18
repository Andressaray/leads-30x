import type { CalidadLead, Canal, EstadoContacto } from "./types";

export const NOMBRE_ESTADO: Record<EstadoContacto, string> = {
  PENDIENTE: "Pendiente",
  CONTACTADO: "Sin respuesta",
  RESPONDIO: "Respondió",
  INTERESADO: "Interesado",
  NO_INTERESADO: "No interesado",
  REBOTADO: "Rebotó",
};

export const NOMBRE_CANAL: Record<Canal, string> = { EMAIL: "Correo", WHATSAPP: "WhatsApp", LLAMADA: "Llamada", OTRO: "Otro", DAPTA: "Agente de Dapta" };

export const NOMBRE_CALIDAD: Record<CalidadLead, string> = { ALTA: "Calidad alta", MEDIA: "Calidad media", BAJA: "Calidad baja", DESCARTADO: "Descartado" };

/** Enlace de WhatsApp con el mensaje escrito (wa.me necesita el número con indicativo y sin signos). */
export function enlaceWhatsapp(numero: string, mensaje: string): string {
  const digitos = numero.replace(/\D/g, "");
  const conIndicativo = digitos.length === 10 ? `57${digitos}` : digitos;
  return `https://wa.me/${conIndicativo}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}

export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
