import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PanelContacto } from "@/modules/contacto";
import type { Plantilla } from "@/modules/contacto";
import type { FichaContacto } from "@/modules/contacto/types";
import { sessionStore } from "@/shared/lib/session-store";
import { sesion } from "../../../helpers/fixtures";
import { falla, llamada, mockFetch, ok } from "../../../helpers/http";
import { ficha, interaccion } from "./ficha";

const PLANTILLAS: Plantilla[] = [
  { id: 1, nombre: "Presentación", canal: "EMAIL", asunto: "Hola {{nombre}}", cuerpo: "…", activa: true, creadoPorId: null },
  { id: 2, nombre: "Seguimiento", canal: "EMAIL", asunto: "¿Seguimos?", cuerpo: "…", activa: true, creadoPorId: null },
  { id: 3, nombre: "WA corto", canal: "WHATSAPP", asunto: null, cuerpo: "…", activa: true, creadoPorId: null },
];

const DAPTA = { modo: "activo", contacta: false, webhook: true, urlWebhook: null };

/** API falsa del panel. `fichas` se van entregando en orden (la última se repite) para simular la recarga. */
function api(fichas: FichaContacto[], extra: Parameters<typeof mockFetch>[0] = {}) {
  let i = 0;
  return mockFetch({
    "GET /api/leads/5/contacto": () => ok(fichas[Math.min(i++, fichas.length - 1)]),
    "/api/plantillas": ok(PLANTILLAS),
    "POST /api/leads/5/contacto/vista-previa": (_u, init) => {
      const { plantillaId } = JSON.parse(String(init.body)) as { plantillaId: number };
      return ok({ asunto: `Asunto ${plantillaId}`, mensaje: `Mensaje de la plantilla ${plantillaId} para Café Andino`, pie: "Para no recibir más correos responde BAJA." });
    },
    "/api/dapta/estado": ok(DAPTA),
    "/api/leads/5/calificaciones": ok([]),
    ...extra,
  });
}

const peticiones = (f: ReturnType<typeof mockFetch>, metodoRuta: string) =>
  f.mock.calls
    .map((_c, i) => llamada(f, i))
    .filter(({ url, init }) => `${init.method ?? "GET"} ${url.pathname}` === metodoRuta);

const dialogo = () => screen.getByRole("dialog");

describe("PanelContacto", () => {
  beforeEach(() => sessionStore.set(sesion({ id: 7 })));
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("carga la ficha, rellena la primera plantilla y envía el correo", async () => {
    const f = api([ficha(), ficha({ lead: { estadoContacto: "CONTACTADO" }, interacciones: [interaccion()] })], {
      "POST /api/leads/5/correo": ok({ interaccion: interaccion(), lead: ficha().lead }),
    });
    const onCerrar = vi.fn();
    render(<PanelContacto leadId={5} onCerrar={onCerrar} />);

    expect(await screen.findByRole("heading", { name: "Café Andino" })).toBeInTheDocument();
    expect(dialogo()).toHaveTextContent("Medellín, Antioquia");
    expect(screen.getByRole("tab", { name: "Correo" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByDisplayValue("Asunto 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Mensaje")).toHaveValue("Mensaje de la plantilla 1 para Café Andino");
    expect(screen.getByText(/Para no recibir más correos/)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Para"), "ventas@andino.co");
    await userEvent.selectOptions(screen.getByLabelText("Plantilla"), "2");
    expect(await screen.findByDisplayValue("Asunto 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enviar correo" }));

    expect(await screen.findByText("Correo enviado a ventas@andino.co.")).toBeInTheDocument();
    expect(peticiones(f, "POST /api/leads/5/correo")[0].body).toEqual({
      para: "ventas@andino.co",
      asunto: "Asunto 2",
      mensaje: "Mensaje de la plantilla 2 para Café Andino",
      plantillaId: 2,
    });
    // Recarga la ficha: ya aparece la sección de respuesta y el historial.
    expect(await screen.findByRole("heading", { name: "Registrar respuesta" })).toBeInTheDocument();
    expect(screen.getByText("Correo enviado")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onCerrar).toHaveBeenCalledWith(true);
  });

  it("Escape cierra sin cambios y bloquea el scroll mientras está abierto", async () => {
    api([ficha()]);
    const onCerrar = vi.fn();
    render(<PanelContacto leadId={5} onCerrar={onCerrar} />);
    await screen.findByRole("heading", { name: "Café Andino" });
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(onCerrar).toHaveBeenCalledWith(false);
  });

  it("si la ficha no carga lo avisa", async () => {
    api([], { "GET /api/leads/5/contacto": falla(404, "Lead no encontrado") });
    render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el lead.Lead no encontrado");
  });

  it("abre en la pestaña del último canal usado (Dapta cuenta como llamada)", async () => {
    api([ficha({ lead: { estadoContacto: "CONTACTADO" }, interacciones: [interaccion({ canal: "DAPTA" })] })]);
    render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
    expect(await screen.findByRole("tab", { name: "Llamada" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: "Llamar a (604) 444-5566" })).toHaveAttribute("href", "tel:6044445566");
  });

  it("sin correo abre en WhatsApp y avisa los canales vacíos", async () => {
    api([ficha({ canales: { email: [], whatsapp: ["3001234567"], telefono: [] } })]);
    render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
    expect(await screen.findByRole("tab", { name: "WhatsApp" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Correo" }));
    expect(screen.getByText("Este lead no tiene correo registrado.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Llamada" }));
    expect(screen.getByText("Este lead no tiene teléfono registrado.")).toBeInTheDocument();
  });

  it("fuera del horario legal deja ver el formulario pero no enviar", async () => {
    const motivo = "Fuera del horario permitido por la Ley 2300 (lunes a viernes 7 a. m. – 7 p. m.).";
    api([ficha({ horarioLegal: false, permiso: { motivo, porCanal: { EMAIL: null, WHATSAPP: null, LLAMADA: null } } })]);
    render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
    await screen.findByRole("heading", { name: "Café Andino" });

    expect(screen.getAllByText(motivo).length).toBeGreaterThan(0);
    const enviar = screen.getByRole("button", { name: "Enviar correo" });
    expect(enviar).toBeDisabled();
    expect(enviar).toHaveAttribute("title", motivo);
  });

  it("un bloqueo de un solo canal solo afecta esa pestaña", async () => {
    api([ficha({ permiso: { motivo: null, porCanal: { EMAIL: "Ya se le escribió por correo esta semana.", WHATSAPP: null, LLAMADA: null } } })]);
    render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Enviar correo" })).toBeDisabled();
    await userEvent.click(screen.getByRole("tab", { name: "Llamada" }));
    expect(screen.getByRole("button", { name: "Registrar llamada" })).toBeEnabled();
  });

  it.each([
    ["pidió no ser contactado", { noContactar: true }],
    ["no está interesado", { estadoContacto: "NO_INTERESADO" as const }],
  ])("si %s no muestra los formularios de contacto", async (_c, cambiosLead) => {
    api([ficha({ lead: cambiosLead, permiso: { motivo: "No se puede contactar.", porCanal: { EMAIL: null, WHATSAPP: null, LLAMADA: null } } })]);
    render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
    await screen.findByRole("heading", { name: "Café Andino" });
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getAllByText("No se puede contactar.").length).toBeGreaterThan(0);
  });

  it("un lead de otra persona es de solo lectura (salvo para un administrador)", async () => {
    const deAna = ficha({
      lead: { estadoContacto: "CONTACTADO", contactadoPorId: 2, contactadoPor: { id: 2, fullName: "Ana Ruiz", email: "ana@l.co" } },
    });
    api([deAna]);
    const { unmount } = render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
    await screen.findByRole("heading", { name: "Café Andino" });

    expect(dialogo()).toHaveTextContent("Lo trabaja Ana Ruiz");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Registrar respuesta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Calificar a mano" })).not.toBeInTheDocument();
    unmount();

    sessionStore.set(sesion({ id: 1, rol: "ADMIN" }));
    render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
    expect(await screen.findByRole("tablist")).toBeInTheDocument();
  });

  it("WhatsApp: registra el contacto y abre wa.me con el mensaje", async () => {
    const pestana = { location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(pestana as unknown as Window);
    const f = api([ficha({ canales: { email: [], whatsapp: ["300 123 4567"], telefono: [] } })], {
      "POST /api/leads/5/interacciones": ok({ interaccion: interaccion({ canal: "WHATSAPP" }), lead: ficha().lead }),
    });
    render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
    await screen.findByDisplayValue("Mensaje de la plantilla 3 para Café Andino");

    await userEvent.click(screen.getByRole("button", { name: "Abrir WhatsApp y registrar" }));

    expect(await screen.findByText(/WhatsApp registrado/)).toBeInTheDocument();
    expect(peticiones(f, "POST /api/leads/5/interacciones")[0].body).toEqual({
      canal: "WHATSAPP",
      destino: "300 123 4567",
      mensaje: "Mensaje de la plantilla 3 para Café Andino",
      plantillaId: 3,
    });
    expect(pestana.location.href).toBe(
      `https://wa.me/573001234567?text=${encodeURIComponent("Mensaje de la plantilla 3 para Café Andino")}`,
    );
  });

  it("WhatsApp: si la API no lo permite, cierra la pestaña y muestra el motivo", async () => {
    const pestana = { location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(pestana as unknown as Window);
    api([ficha({ canales: { email: [], whatsapp: ["3001234567"], telefono: [] } })], {
      "POST /api/leads/5/interacciones": falla(422, "Fuera del horario legal"),
    });
    render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Abrir WhatsApp y registrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Fuera del horario legal");
    expect(pestana.close).toHaveBeenCalled();
    expect(pestana.location.href).toBe("");
  });

  it("registra una llamada con su nota", async () => {
    const f = api([ficha({ canales: { email: [], whatsapp: [], telefono: ["6044445566"] } })], {
      "POST /api/leads/5/interacciones": ok({ interaccion: interaccion({ canal: "LLAMADA" }), lead: ficha().lead }),
    });
    render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
    await userEvent.type(await screen.findByLabelText("Nota de la llamada"), "Habló con la dueña");
    await userEvent.click(screen.getByRole("button", { name: "Registrar llamada" }));

    expect(await screen.findByText(/Llamada registrada/)).toBeInTheDocument();
    expect(peticiones(f, "POST /api/leads/5/interacciones")[0].body).toEqual({ canal: "LLAMADA", destino: "6044445566", nota: "Habló con la dueña" });
  });

  it("registrar respuesta pide elegir el resultado y usa el último canal", async () => {
    const f = api([ficha({ lead: { estadoContacto: "CONTACTADO" }, interacciones: [interaccion({ canal: "WHATSAPP" })] })], {
      "POST /api/leads/5/respuesta": ok({ interaccion: interaccion(), lead: ficha().lead }),
    });
    render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
    await screen.findByRole("heading", { name: "Registrar respuesta" });

    await userEvent.click(screen.getByRole("button", { name: "Guardar respuesta" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Elige cómo respondió.");

    await userEvent.click(screen.getByRole("radio", { name: /Interesado/ }));
    await userEvent.type(screen.getByPlaceholderText("Opcional"), "Pide cotización");
    await userEvent.click(screen.getByRole("button", { name: "Guardar respuesta" }));

    expect(await screen.findByText("Respuesta registrada.")).toBeInTheDocument();
    expect(peticiones(f, "POST /api/leads/5/respuesta")[0].body).toEqual({ canal: "WHATSAPP", resultado: "INTERESADO", nota: "Pide cotización" });
  });

  it("marcar 'no contactar' pide confirmación", async () => {
    const f = api([ficha()], { "POST /api/leads/5/no-contactar": ok(ficha({ lead: { noContactar: true } }).lead) });
    render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Pidió no volver a ser contactado" }));
    await userEvent.type(screen.getByPlaceholderText("Cómo lo pidió (opcional)"), "Respondió BAJA");
    await userEvent.click(screen.getByRole("button", { name: "Sí, no contactar más" }));

    expect(await screen.findByText("Listo: no se le volverá a escribir ni llamar.")).toBeInTheDocument();
    expect(peticiones(f, "POST /api/leads/5/no-contactar")[0].body).toEqual({ nota: "Respondió BAJA" });
  });

  it("avisa si el correo está en modo simulado", async () => {
    api([ficha({ correo: { modo: "simulado" } })]);
    render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
    expect(await screen.findByText("Correo en modo simulado")).toBeInTheDocument();
  });

  describe("calificación", () => {
    it("califica a mano", async () => {
      const f = api([ficha()], {
        "POST /api/leads/5/calificacion": ok({ id: 1, origen: "MANUAL", estado: "CALIFICADO", calidad: "ALTA" }),
      });
      render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
      await userEvent.click(await screen.findByRole("button", { name: "Calificar a mano" }));

      await userEvent.click(screen.getByRole("button", { name: "Guardar calificación" }));
      expect(screen.getByRole("alert")).toHaveTextContent("Elige la calidad.");

      await userEvent.click(screen.getByRole("radio", { name: "alta" }));
      await userEvent.type(screen.getByPlaceholderText("0 a 100"), "90");
      await userEvent.click(screen.getByRole("button", { name: "Guardar calificación" }));

      expect(await screen.findByText("Calificado a mano: calidad alta.")).toBeInTheDocument();
      expect(peticiones(f, "POST /api/leads/5/calificacion")[0].body).toEqual({ calidad: "ALTA", puntaje: 90 });
    });

    it("no deja reenviar a Dapta mientras espera la calificación", async () => {
      api([ficha()], {
        "/api/leads/5/calificaciones": ok([
          { id: 9, usuario: { id: 7, fullName: "Andrés Saray" }, origen: "DAPTA", estado: "ENVIADO", calidad: null, puntaje: null, resumen: null, error: null, calificadoEn: null, createdAt: "2026-10-15T15:00:00Z" },
        ]),
      });
      render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
      const enviar = await screen.findByRole("button", { name: "Enviar a Dapta" });
      await vi.waitFor(() => expect(enviar).toBeDisabled());
      expect(enviar).toHaveAttribute("title", "Ya está en Dapta esperando la calificación");
      expect(screen.getByText("Esperando a Dapta")).toBeInTheDocument();
    });

    it("si Dapta llama, respeta las reglas de llamada", async () => {
      api([ficha({ permiso: { motivo: null, porCanal: { EMAIL: null, WHATSAPP: null, LLAMADA: "Ya se le llamó esta semana." } } })], {
        "/api/dapta/estado": ok({ ...DAPTA, contacta: true }),
      });
      render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
      expect(await screen.findByText("Dapta llama al lead: Ya se le llamó esta semana.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Enviar a Dapta" })).toBeDisabled();
    });

    it("envía a Dapta", async () => {
      const f = api([ficha()], { "POST /api/leads/5/dapta": ok({ id: 3, origen: "DAPTA", estado: "ENVIADO" }) });
      render(<PanelContacto leadId={5} onCerrar={vi.fn()} />);
      const seccion = (await screen.findByRole("heading", { name: "Calificación" })).parentElement!;
      await userEvent.click(within(seccion).getByRole("button", { name: "Enviar a Dapta" }));
      expect(await screen.findByText(/Enviado a Dapta\. La calificación llega/)).toBeInTheDocument();
      expect(peticiones(f, "POST /api/leads/5/dapta")).toHaveLength(1);
    });
  });
});
