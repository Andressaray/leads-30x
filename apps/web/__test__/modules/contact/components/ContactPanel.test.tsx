import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContactPanel } from "@/modules/contact";
import type { Template } from "@/modules/contact";
import type { ContactSheet } from "@/modules/contact/types";
import { sessionStore } from "@/shared/lib/session-store";
import { session } from "../../../helpers/fixtures";
import { failure, call, mockFetch, ok } from "../../../helpers/http";
import { sheet, interaction } from "./sheet";

const TEMPLATES: Template[] = [
  { id: 1, name: "Presentación", channel: "EMAIL", subject: "Hola {{nombre}}", body: "…", active: true, createdById: null },
  { id: 2, name: "Seguimiento", channel: "EMAIL", subject: "¿Seguimos?", body: "…", active: true, createdById: null },
  { id: 3, name: "WA corto", channel: "WHATSAPP", subject: null, body: "…", active: true, createdById: null },
];

const DAPTA = { mode: "active", contacts: false, webhook: true, urlWebhook: null };

/** Fake API of the panel. `sheets` are delivered in order (the last one repeats) to simulate the reload. */
function api(cards: ContactSheet[], extra: Parameters<typeof mockFetch>[0] = {}) {
  let i = 0;
  return mockFetch({
    "GET /api/leads/5/contact": () => ok(cards[Math.min(i++, cards.length - 1)]),
    "/api/templates": ok(TEMPLATES),
    "POST /api/leads/5/contact/preview": (_u, init) => {
      const { templateId } = JSON.parse(String(init.body)) as { templateId: number };
      return ok({ subject: `Asunto ${templateId}`, message: `Mensaje de la plantilla ${templateId} para Café Andino`, footer: "Para no recibir más correos responde BAJA." });
    },
    "/api/dapta/status": ok(DAPTA),
    "/api/leads/5/qualifications": ok([]),
    ...extra,
  });
}

const requests = (f: ReturnType<typeof mockFetch>, routeMethod: string) =>
  f.mock.calls
    .map((_c, i) => call(f, i))
    .filter(({ url, init }) => `${init.method ?? "GET"} ${url.pathname}` === routeMethod);

const dialog = () => screen.getByRole("dialog");

describe("PanelContacto", () => {
  beforeEach(() => sessionStore.set(session({ id: 7 })));
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("loads the contact sheet, fills the first template and sends the email", async () => {
    const f = api([sheet(), sheet({ lead: { contactStatus: "CONTACTED" }, interactions: [interaction()] })], {
      "POST /api/leads/5/email": ok({ interaction: interaction(), lead: sheet().lead }),
    });
    const onClose = vi.fn();
    render(<ContactPanel leadId={5} onClose={onClose} />);

    expect(await screen.findByRole("heading", { name: "Café Andino" })).toBeInTheDocument();
    expect(dialog()).toHaveTextContent("Medellín, Antioquia");
    expect(screen.getByRole("tab", { name: "Correo" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByDisplayValue("Asunto 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Mensaje")).toHaveValue("Mensaje de la plantilla 1 para Café Andino");
    expect(screen.getByText(/Para no recibir más correos/)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Para"), "ventas@andino.co");
    await userEvent.selectOptions(screen.getByLabelText("Plantilla"), "2");
    expect(await screen.findByDisplayValue("Asunto 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enviar correo" }));

    expect(await screen.findByText("Correo enviado a ventas@andino.co.")).toBeInTheDocument();
    expect(requests(f, "POST /api/leads/5/email")[0].body).toEqual({
      to: "ventas@andino.co",
      subject: "Asunto 2",
      message: "Mensaje de la plantilla 2 para Café Andino",
      templateId: 2,
    });
    // Reloads the contact sheet: the reply section and the history now appear.
    expect(await screen.findByRole("heading", { name: "Registrar respuesta" })).toBeInTheDocument();
    expect(screen.getByText("Correo enviado")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("Escape closes without changes and locks scrolling while open", async () => {
    api([sheet()]);
    const onClose = vi.fn();
    render(<ContactPanel leadId={5} onClose={onClose} />);
    await screen.findByRole("heading", { name: "Café Andino" });
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("if the contact sheet does not load it says so", async () => {
    api([], { "GET /api/leads/5/contact": failure(404, "Lead no encontrado") });
    render(<ContactPanel leadId={5} onClose={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el lead.Lead no encontrado");
  });

  it("opens on the tab of the last channel used (Dapta counts as a call)", async () => {
    api([sheet({ lead: { contactStatus: "CONTACTED" }, interactions: [interaction({ channel: "DAPTA" })] })]);
    render(<ContactPanel leadId={5} onClose={vi.fn()} />);
    expect(await screen.findByRole("tab", { name: "Llamada" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: "Llamar a (604) 444-5566" })).toHaveAttribute("href", "tel:6044445566");
  });

  it("without email it opens on WhatsApp and points out the empty channels", async () => {
    api([sheet({ channels: { email: [], whatsapp: ["3001234567"], phone: [] } })]);
    render(<ContactPanel leadId={5} onClose={vi.fn()} />);
    expect(await screen.findByRole("tab", { name: "WhatsApp" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Correo" }));
    expect(screen.getByText("Este lead no tiene correo registrado.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Llamada" }));
    expect(screen.getByText("Este lead no tiene teléfono registrado.")).toBeInTheDocument();
  });

  it("outside legal hours it shows the form but does not allow sending", async () => {
    const reason = "Fuera del horario permitido por la Ley 2300 (lunes a viernes 7 a. m. – 7 p. m.).";
    api([sheet({ legalHours: false, permission: { reason, byChannel: { EMAIL: null, WHATSAPP: null, CALL: null } } })]);
    render(<ContactPanel leadId={5} onClose={vi.fn()} />);
    await screen.findByRole("heading", { name: "Café Andino" });

    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    const send = screen.getByRole("button", { name: "Enviar correo" });
    expect(send).toBeDisabled();
    expect(send).toHaveAttribute("title", reason);
  });

  it("a block on a single channel only affects that tab", async () => {
    api([sheet({ permission: { reason: null, byChannel: { EMAIL: "Ya se le escribió por correo esta semana.", WHATSAPP: null, CALL: null } } })]);
    render(<ContactPanel leadId={5} onClose={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Enviar correo" })).toBeDisabled();
    await userEvent.click(screen.getByRole("tab", { name: "Llamada" }));
    expect(screen.getByRole("button", { name: "Registrar llamada" })).toBeEnabled();
  });

  it.each([
    ["pidió no ser contactado", { doNotContact: true }],
    ["no está interesado", { contactStatus: "NOT_INTERESTED" as const }],
  ])("if %s it does not show the contact forms", async (_c, leadChanges) => {
    api([sheet({ lead: leadChanges, permission: { reason: "No se puede contactar.", byChannel: { EMAIL: null, WHATSAPP: null, CALL: null } } })]);
    render(<ContactPanel leadId={5} onClose={vi.fn()} />);
    await screen.findByRole("heading", { name: "Café Andino" });
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getAllByText("No se puede contactar.").length).toBeGreaterThan(0);
  });

  it("someone else's lead is read-only (except for an administrator)", async () => {
    const byAna = sheet({
      lead: { contactStatus: "CONTACTED", contactedById: 2, contactedBy: { id: 2, fullName: "Ana Ruiz", email: "ana@l.co" } },
    });
    api([byAna]);
    const { unmount } = render(<ContactPanel leadId={5} onClose={vi.fn()} />);
    await screen.findByRole("heading", { name: "Café Andino" });

    expect(dialog()).toHaveTextContent("Lo trabaja Ana Ruiz");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Registrar respuesta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Calificar a mano" })).not.toBeInTheDocument();
    unmount();

    sessionStore.set(session({ id: 1, role: "ADMIN" }));
    render(<ContactPanel leadId={5} onClose={vi.fn()} />);
    expect(await screen.findByRole("tablist")).toBeInTheDocument();
  });

  it("WhatsApp: records the contact and opens wa.me with the message", async () => {
    const tab = { location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const f = api([sheet({ channels: { email: [], whatsapp: ["300 123 4567"], phone: [] } })], {
      "POST /api/leads/5/interactions": ok({ interaction: interaction({ channel: "WHATSAPP" }), lead: sheet().lead }),
    });
    render(<ContactPanel leadId={5} onClose={vi.fn()} />);
    await screen.findByDisplayValue("Mensaje de la plantilla 3 para Café Andino");

    await userEvent.click(screen.getByRole("button", { name: "Abrir WhatsApp y registrar" }));

    expect(await screen.findByText(/WhatsApp registrado/)).toBeInTheDocument();
    expect(requests(f, "POST /api/leads/5/interactions")[0].body).toEqual({
      channel: "WHATSAPP",
      destination: "300 123 4567",
      message: "Mensaje de la plantilla 3 para Café Andino",
      templateId: 3,
    });
    expect(tab.location.href).toBe(
      `https://wa.me/573001234567?text=${encodeURIComponent("Mensaje de la plantilla 3 para Café Andino")}`,
    );
  });

  it("WhatsApp: if the API does not allow it, it closes the tab and shows the reason", async () => {
    const tab = { location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    api([sheet({ channels: { email: [], whatsapp: ["3001234567"], phone: [] } })], {
      "POST /api/leads/5/interactions": failure(422, "Fuera del horario legal"),
    });
    render(<ContactPanel leadId={5} onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Abrir WhatsApp y registrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Fuera del horario legal");
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.href).toBe("");
  });

  it("records a call with its note", async () => {
    const f = api([sheet({ channels: { email: [], whatsapp: [], phone: ["6044445566"] } })], {
      "POST /api/leads/5/interactions": ok({ interaction: interaction({ channel: "CALL" }), lead: sheet().lead }),
    });
    render(<ContactPanel leadId={5} onClose={vi.fn()} />);
    await userEvent.type(await screen.findByLabelText("Nota de la llamada"), "Habló con la dueña");
    await userEvent.click(screen.getByRole("button", { name: "Registrar llamada" }));

    expect(await screen.findByText(/Llamada registrada/)).toBeInTheDocument();
    expect(requests(f, "POST /api/leads/5/interactions")[0].body).toEqual({ channel: "CALL", destination: "6044445566", note: "Habló con la dueña" });
  });

  it("recording a reply asks to choose the result and uses the last channel", async () => {
    const f = api([sheet({ lead: { contactStatus: "CONTACTED" }, interactions: [interaction({ channel: "WHATSAPP" })] })], {
      "POST /api/leads/5/reply": ok({ interaction: interaction(), lead: sheet().lead }),
    });
    render(<ContactPanel leadId={5} onClose={vi.fn()} />);
    await screen.findByRole("heading", { name: "Registrar respuesta" });

    await userEvent.click(screen.getByRole("button", { name: "Guardar respuesta" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Elige cómo respondió.");

    await userEvent.click(screen.getByRole("radio", { name: /Interesado/ }));
    await userEvent.type(screen.getByPlaceholderText("Opcional"), "Pide cotización");
    await userEvent.click(screen.getByRole("button", { name: "Guardar respuesta" }));

    expect(await screen.findByText("Respuesta registrada.")).toBeInTheDocument();
    expect(requests(f, "POST /api/leads/5/reply")[0].body).toEqual({ channel: "WHATSAPP", result: "INTERESTED", note: "Pide cotización" });
  });

  it("marking 'do not contact' asks for confirmation", async () => {
    const f = api([sheet()], { "POST /api/leads/5/do-not-contact": ok(sheet({ lead: { doNotContact: true } }).lead) });
    render(<ContactPanel leadId={5} onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Pidió no volver a ser contactado" }));
    await userEvent.type(screen.getByPlaceholderText("Cómo lo pidió (opcional)"), "Respondió BAJA");
    await userEvent.click(screen.getByRole("button", { name: "Sí, no contactar más" }));

    expect(await screen.findByText("Listo: no se le volverá a escribir ni llamar.")).toBeInTheDocument();
    expect(requests(f, "POST /api/leads/5/do-not-contact")[0].body).toEqual({ note: "Respondió BAJA" });
  });

  it("warns if email is in simulated mode", async () => {
    api([sheet({ email: { mode: "simulated" } })]);
    render(<ContactPanel leadId={5} onClose={vi.fn()} />);
    expect(await screen.findByText("Correo en modo simulado")).toBeInTheDocument();
  });

  describe("qualification", () => {
    it("qualifies manually", async () => {
      const f = api([sheet()], {
        "POST /api/leads/5/qualification": ok({ id: 1, origin: "MANUAL", status: "QUALIFIED", quality: "HIGH" }),
      });
      render(<ContactPanel leadId={5} onClose={vi.fn()} />);
      await userEvent.click(await screen.findByRole("button", { name: "Calificar a mano" }));

      await userEvent.click(screen.getByRole("button", { name: "Guardar calificación" }));
      expect(screen.getByRole("alert")).toHaveTextContent("Elige la calidad.");

      await userEvent.click(screen.getByRole("radio", { name: "alta" }));
      await userEvent.type(screen.getByPlaceholderText("0 a 100"), "90");
      await userEvent.click(screen.getByRole("button", { name: "Guardar calificación" }));

      expect(await screen.findByText("Calificado a mano: calidad alta.")).toBeInTheDocument();
      expect(requests(f, "POST /api/leads/5/qualification")[0].body).toEqual({ quality: "HIGH", score: 90 });
    });

    it("does not allow resending to Dapta while waiting for the qualification", async () => {
      api([sheet()], {
        "/api/leads/5/qualifications": ok([
          { id: 9, user: { id: 7, fullName: "Andrés Saray" }, origin: "DAPTA", status: "SENT", quality: null, score: null, summary: null, error: null, qualifiedAt: null, createdAt: "2026-10-15T15:00:00Z" },
        ]),
      });
      render(<ContactPanel leadId={5} onClose={vi.fn()} />);
      const send = await screen.findByRole("button", { name: "Enviar a Dapta" });
      await vi.waitFor(() => expect(send).toBeDisabled());
      expect(send).toHaveAttribute("title", "Ya está en Dapta esperando la calificación");
      expect(screen.getByText("Esperando a Dapta")).toBeInTheDocument();
    });

    it("if Dapta calls, it respects the call rules", async () => {
      api([sheet({ permission: { reason: null, byChannel: { EMAIL: null, WHATSAPP: null, CALL: "Ya se le llamó esta semana." } } })], {
        "/api/dapta/status": ok({ ...DAPTA, contacts: true }),
      });
      render(<ContactPanel leadId={5} onClose={vi.fn()} />);
      expect(await screen.findByText("Dapta llama al lead: Ya se le llamó esta semana.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Enviar a Dapta" })).toBeDisabled();
    });

    it("sends to Dapta", async () => {
      const f = api([sheet()], { "POST /api/leads/5/dapta": ok({ id: 3, origin: "DAPTA", status: "SENT" }) });
      render(<ContactPanel leadId={5} onClose={vi.fn()} />);
      const section = (await screen.findByRole("heading", { name: "Calificación" })).parentElement!;
      await userEvent.click(within(section).getByRole("button", { name: "Enviar a Dapta" }));
      expect(await screen.findByText(/Enviado a Dapta\. La calificación llega/)).toBeInTheDocument();
      expect(requests(f, "POST /api/leads/5/dapta")).toHaveLength(1);
    });
  });
});
