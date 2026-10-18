import type { ContactSheet, Interaction } from "@/modules/contact/types";

/** Contact sheet of a pending lead, with email, WhatsApp and phone, and no blocks. */
export function sheet(changes: { lead?: Partial<ContactSheet["lead"]> } & Partial<Omit<ContactSheet, "lead">> = {}): ContactSheet {
  const { lead, ...rest } = changes;
  return {
    lead: {
      id: 5,
      name: "Café Andino",
      municipality: "MEDELLÍN",
      department: "Antioquia",
      phones: [{ number: "3001234567", type: "mobile", whatsapp: true }],
      emails: ["hola@andino.co"],
      contactedById: null,
      contactedBy: null,
      contactStatus: "PENDING",
      lastContactedAt: null,
      repliedAt: null,
      doNotContact: false,
      quality: null,
      score: null,
      qualifiedAt: null,
      ...lead,
    },
    interactions: [],
    channels: { email: ["hola@andino.co", "ventas@andino.co"], whatsapp: ["3001234567"], phone: ["(604) 444-5566"] },
    permission: { reason: null, byChannel: { EMAIL: null, WHATSAPP: null, CALL: null } },
    email: { mode: "smtp" },
    legalHours: true,
    ...rest,
  };
}

export function interaction(changes: Partial<Interaction> = {}): Interaction {
  return {
    id: 1,
    user: { id: 7, fullName: "Andrés Saray" },
    channel: "EMAIL",
    direction: "OUTBOUND",
    status: "SENT",
    destination: "hola@andino.co",
    subject: "Hola",
    message: "Mensaje",
    note: null,
    result: null,
    error: null,
    createdAt: "2026-10-15T15:00:00Z",
    ...changes,
  };
}
