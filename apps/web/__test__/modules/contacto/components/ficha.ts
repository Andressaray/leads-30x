import type { FichaContacto, Interaccion } from "@/modules/contacto/types";

/** Ficha de contacto de un lead pendiente, con correo, WhatsApp y teléfono, y sin bloqueos. */
export function ficha(cambios: { lead?: Partial<FichaContacto["lead"]> } & Partial<Omit<FichaContacto, "lead">> = {}): FichaContacto {
  const { lead, ...resto } = cambios;
  return {
    lead: {
      id: 5,
      nombre: "Café Andino",
      municipio: "MEDELLÍN",
      departamento: "Antioquia",
      telefonos: [{ numero: "3001234567", tipo: "movil", whatsapp: true }],
      emails: ["hola@andino.co"],
      contactadoPorId: null,
      contactadoPor: null,
      estadoContacto: "PENDIENTE",
      ultimoContactoEn: null,
      respondioEn: null,
      noContactar: false,
      calidad: null,
      puntaje: null,
      calificadoEn: null,
      ...lead,
    },
    interacciones: [],
    canales: { email: ["hola@andino.co", "ventas@andino.co"], whatsapp: ["3001234567"], telefono: ["(604) 444-5566"] },
    permiso: { motivo: null, porCanal: { EMAIL: null, WHATSAPP: null, LLAMADA: null } },
    correo: { modo: "smtp" },
    horarioLegal: true,
    ...resto,
  };
}

export function interaccion(cambios: Partial<Interaccion> = {}): Interaccion {
  return {
    id: 1,
    usuario: { id: 7, fullName: "Andrés Saray" },
    canal: "EMAIL",
    sentido: "SALIENTE",
    estado: "ENVIADO",
    destino: "hola@andino.co",
    asunto: "Hola",
    mensaje: "Mensaje",
    nota: null,
    resultado: null,
    error: null,
    createdAt: "2026-10-15T15:00:00Z",
    ...cambios,
  };
}
