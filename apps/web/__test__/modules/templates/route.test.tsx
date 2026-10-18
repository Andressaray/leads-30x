import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import TemplatesPage from "@/modules/templates/route";
import type { Template } from "@/modules/contact";
import { sessionStore } from "@/shared/lib/session-store";
import { session } from "../../helpers/fixtures";
import { failure, call, mockFetch, ok } from "../../helpers/http";

const p = (c: Partial<Template>): Template => ({ id: 1, name: "P", channel: "EMAIL", subject: null, body: "Cuerpo de prueba", active: true, createdById: null, ...c });

const TEMPLATES = [
  p({ id: 1, name: "Inicial de correo", subject: "Hola {{nombre}}", createdById: null }),
  p({ id: 2, name: "Mi WhatsApp", channel: "WHATSAPP", createdById: 7, createdBy: { id: 7, fullName: "Andrés Saray" } }),
  p({ id: 3, name: "Guion de Ana", channel: "CALL", createdById: 2, createdBy: { id: 2, fullName: "Ana Ruiz" } }),
  p({ id: 4, name: "Vieja", channel: "WHATSAPP", active: false, createdById: 7 }),
];

const VARIABLES = [
  { name: "nombre", description: "Nombre del negocio" },
  { name: "municipio", description: "Ciudad" },
];

const card = (name: string) => screen.getByText(name).closest("article")!;
const names = () => screen.queryAllByRole("article").map((a) => a.querySelector("b")?.textContent);

describe("Templates", () => {
  beforeEach(() => sessionStore.set(session({ id: 7 })));

  it("lists the active ones (includes deactivated ones only when asked) and filters by channel", async () => {
    const f = mockFetch({ "/api/templates": ok(TEMPLATES) });
    render(<TemplatesPage />);

    expect(await screen.findByText("Inicial de correo")).toBeInTheDocument();
    expect(call(f).url.search).toBe("?inactive=true");
    expect(names()).toEqual(["Inicial de correo", "Mi WhatsApp", "Guion de Ana"]);
    expect(within(card("Inicial de correo")).getByText("Plantilla inicial")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Mostrar desactivadas"));
    expect(names()).toContain("Vieja");

    await userEvent.click(screen.getByRole("tab", { name: "WhatsApp" }));
    expect(names()).toEqual(["Mi WhatsApp", "Vieja"]);

    await userEvent.click(screen.getByRole("tab", { name: "Correo" }));
    await userEvent.click(screen.getByLabelText("Mostrar desactivadas"));
    await userEvent.click(screen.getByRole("tab", { name: "Llamada" }));
    expect(names()).toEqual(["Guion de Ana"]);
  });

  it("only your own can be edited (or all of them for an administrator)", async () => {
    mockFetch({ "/api/templates": ok(TEMPLATES) });
    const { unmount } = render(<TemplatesPage />);
    await screen.findByText("Mi WhatsApp");
    expect(within(card("Mi WhatsApp")).getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(within(card("Guion de Ana")).queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(within(card("Inicial de correo")).queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    unmount();

    sessionStore.set(session({ id: 1, role: "ADMIN" }));
    render(<TemplatesPage />);
    await screen.findByText("Guion de Ana");
    expect(within(card("Guion de Ana")).getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("deactivates a template and reloads the list", async () => {
    let list = TEMPLATES;
    const f = mockFetch({
      "GET /api/templates": () => ok(list),
      "PATCH /api/templates/2": () => {
        list = list.map((x) => (x.id === 2 ? { ...x, active: false } : x));
        return ok(list[1]);
      },
    });
    render(<TemplatesPage />);
    await screen.findByText("Mi WhatsApp");
    await userEvent.click(within(card("Mi WhatsApp")).getByRole("button", { name: "Desactivar" }));

    // Once deactivated, it disappears from the list (deactivated ones are not being shown).
    await waitFor(() => expect(screen.queryByText("Mi WhatsApp")).not.toBeInTheDocument());
    const patch = f.mock.calls.map((_c, i) => call(f, i)).find((c) => c.init.method === "PATCH")!;
    expect(patch.body).toEqual({ active: false });
  });

  it("creates an email template inserting variables", async () => {
    const f = mockFetch({
      "GET /api/templates": ok([]),
      "/api/templates/variables": ok(VARIABLES),
      "POST /api/templates": ok(p({ id: 9 }), 201),
    });
    render(<TemplatesPage />);
    expect(await screen.findByText("No hay plantillas aquí todavía.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Nueva plantilla" }));
    expect(screen.getByRole("heading", { name: "Nueva plantilla" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nueva plantilla" })).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Nombre"), "Primer contacto");
    await userEvent.type(screen.getByLabelText("Asunto"), "Propuesta");
    await userEvent.type(screen.getByLabelText("Mensaje"), "Hola equipo de ");
    await userEvent.click(await screen.findByRole("button", { name: "{{nombre}}" }));
    expect(screen.getByLabelText("Mensaje")).toHaveValue("Hola equipo de {{nombre}}");

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await screen.findByRole("button", { name: "Nueva plantilla" });
    const post = f.mock.calls.map((_c, i) => call(f, i)).find((c) => c.init.method === "POST")!;
    expect(post.body).toEqual({ name: "Primer contacto", body: "Hola equipo de {{nombre}}", subject: "Propuesta", channel: "EMAIL" });
  });

  it("a call script has no subject", async () => {
    const f = mockFetch({ "GET /api/templates": ok([]), "/api/templates/variables": ok([]), "POST /api/templates": ok(p({ id: 9 }), 201) });
    render(<TemplatesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Nueva plantilla" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Canal" }), "CALL");
    expect(screen.queryByLabelText("Asunto")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Nombre"), "Guion");
    await userEvent.type(screen.getByLabelText("Guion"), "Buenos días, le habla…");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await screen.findByRole("button", { name: "Nueva plantilla" });
    const post = f.mock.calls.map((_c, i) => call(f, i)).find((c) => c.init.method === "POST")!;
    expect(post.body).toEqual({ name: "Guion", body: "Buenos días, le habla…", channel: "CALL" });
  });

  it("when editing it does not allow changing the channel and shows the API error", async () => {
    mockFetch({
      "GET /api/templates": ok(TEMPLATES),
      "/api/templates/variables": ok([]),
      "PATCH /api/templates/2": failure(422, "El mensaje es muy corto"),
    });
    render(<TemplatesPage />);
    await screen.findByText("Mi WhatsApp");
    await userEvent.click(within(card("Mi WhatsApp")).getByRole("button", { name: "Editar" }));

    expect(screen.getByRole("heading", { name: "Editar plantilla" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Canal" })).toBeDisabled();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Mi WhatsApp");

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El mensaje es muy corto");

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("heading", { name: "Editar plantilla" })).not.toBeInTheDocument();
  });

  it("if the list does not load it says so", async () => {
    mockFetch({ "/api/templates": failure(500, "caída") });
    render(<TemplatesPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar las plantillas.caída");
  });
});

