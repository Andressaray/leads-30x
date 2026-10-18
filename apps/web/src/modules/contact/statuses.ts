import type { LeadQuality, Channel, ContactStatus } from "./types";

export const STATUS_NAME: Record<ContactStatus, string> = {
  PENDING: "Pendiente",
  CONTACTED: "Sin respuesta",
  REPLIED: "Respondió",
  INTERESTED: "Interesado",
  NOT_INTERESTED: "No interesado",
  BOUNCED: "Rebotó",
};

export const CHANNEL_NAME: Record<Channel, string> = { EMAIL: "Correo", WHATSAPP: "WhatsApp", CALL: "Llamada", OTHER: "Otro", DAPTA: "Agente de Dapta" };

export const QUALITY_NAME: Record<LeadQuality, string> = { HIGH: "Calidad alta", MEDIUM: "Calidad media", LOW: "Calidad baja", DISCARDED: "Descartado" };

/** WhatsApp link with the message written (wa.me needs the number with the country code and no symbols). */
export function whatsappLink(number: string, message: string): string {
  const digits = number.replace(/\D/g, "");
  const withAreaCode = digits.length === 10 ? `57${digits}` : digits;
  return `https://wa.me/${withAreaCode}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
