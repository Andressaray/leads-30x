import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import PlantillasPage from "@/modules/plantillas/route";
import type { Plantilla } from "@/modules/contacto";
import { sessionStore } from "@/shared/lib/session-store";
import { sesion } from "../../helpers/fixtures";
import { falla, llamada, mockFetch, ok } from "../../helpers/http";

const p = (c: Partial<Plantilla>): Plantilla => ({ id: 1, nombre: "P", canal: "EMAIL", asunto: null, cuerpo: "Cuerpo de prueba", activa: true, creadoPorId: null, ...c });

const PLANTILLAS = [
  p({ id: 1, nombre: "Inicial de correo", asunto: "Hola {{nombre}}", creadoPorId: null }),
  p({ id: 2, nombre: "Mi WhatsApp", canal: "WHATSAPP", creadoPorId: 7, creadoPor: { id: 7, fullName: "Andrés Saray" } }),
  p({ id: 3, nombre: "Guion de Ana", canal: "LLAMADA", creadoPorId: 2, creadoPor: { id: 2, fullName: "Ana Ruiz" } }),
  p({ id: 4, nombre: "Vieja", canal: "WHATSAPP", activa: false, creadoPorId: 7 }),
];

const VARIABLES = [
  { nombre: "nombre", descripcion: "Nombre del negocio" },
  { nombre: "municipio", descripcion: "Ciudad" },
];

const tarjeta = (nombre: string) => screen.getByText(nombre).closest("article")!;
const nombres = () => screen.queryAllByRole("article").map((a) => a.querySelector("b")?.textContent);

describe("Plantillas", () => {
  beforeEach(() => sessionStore.set(sesion({ id: 7 })));

  it("lista las activas (incluye desactivadas solo si se pide) y filtra por canal", async () => {
    const f = mockFetch({ "/api/plantillas": ok(PLANTILLAS) });
    render(<PlantillasPage />);

    expect(await screen.findByText("Inicial de correo")).toBeInTheDocument();
    expect(llamada(f).url.search).toBe("?inactivas=true");
    expect(nombres()).toEqual(["Inicial de correo", "Mi WhatsApp", "Guion de Ana"]);
    expect(within(tarjeta("Inicial de correo")).getByText("Plantilla inicial")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Mostrar desactivadas"));
    expect(nombres()).toContain("Vieja");

    await userEvent.click(screen.getByRole("tab", { name: "WhatsApp" }));
    expect(nombres()).toEqual(["Mi WhatsApp", "Vieja"]);

    await userEvent.click(screen.getByRole("tab", { name: "Correo" }));
    await userEvent.click(screen.getByLabelText("Mostrar desactivadas"));
    await userEvent.click(screen.getByRole("tab", { name: "Llamada" }));
    expect(nombres()).toEqual(["Guion de Ana"]);
  });

  it("solo se pueden editar las propias (o todas si es administrador)", async () => {
    mockFetch({ "/api/plantillas": ok(PLANTILLAS) });
    const { unmount } = render(<PlantillasPage />);
    await screen.findByText("Mi WhatsApp");
    expect(within(tarjeta("Mi WhatsApp")).getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(within(tarjeta("Guion de Ana")).queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(within(tarjeta("Inicial de correo")).queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    unmount();

    sessionStore.set(sesion({ id: 1, rol: "ADMIN" }));
    render(<PlantillasPage />);
    await screen.findByText("Guion de Ana");
    expect(within(tarjeta("Guion de Ana")).getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("desactiva una plantilla y recarga la lista", async () => {
    let lista = PLANTILLAS;
    const f = mockFetch({
      "GET /api/plantillas": () => ok(lista),
      "PATCH /api/plantillas/2": () => {
        lista = lista.map((x) => (x.id === 2 ? { ...x, activa: false } : x));
        return ok(lista[1]);
      },
    });
    render(<PlantillasPage />);
    await screen.findByText("Mi WhatsApp");
    await userEvent.click(within(tarjeta("Mi WhatsApp")).getByRole("button", { name: "Desactivar" }));

    // Desactivada, desaparece de la lista (no se están mostrando las desactivadas).
    await waitFor(() => expect(screen.queryByText("Mi WhatsApp")).not.toBeInTheDocument());
    const patch = f.mock.calls.map((_c, i) => llamada(f, i)).find((c) => c.init.method === "PATCH")!;
    expect(patch.body).toEqual({ activa: false });
  });

  it("crea una plantilla de correo insertando variables", async () => {
    const f = mockFetch({
      "GET /api/plantillas": ok([]),
      "/api/plantillas/variables": ok(VARIABLES),
      "POST /api/plantillas": ok(p({ id: 9 }), 201),
    });
    render(<PlantillasPage />);
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
    const post = f.mock.calls.map((_c, i) => llamada(f, i)).find((c) => c.init.method === "POST")!;
    expect(post.body).toEqual({ nombre: "Primer contacto", cuerpo: "Hola equipo de {{nombre}}", asunto: "Propuesta", canal: "EMAIL" });
  });

  it("un guion de llamada no lleva asunto", async () => {
    const f = mockFetch({ "GET /api/plantillas": ok([]), "/api/plantillas/variables": ok([]), "POST /api/plantillas": ok(p({ id: 9 }), 201) });
    render(<PlantillasPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Nueva plantilla" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Canal" }), "LLAMADA");
    expect(screen.queryByLabelText("Asunto")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Nombre"), "Guion");
    await userEvent.type(screen.getByLabelText("Guion"), "Buenos días, le habla…");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await screen.findByRole("button", { name: "Nueva plantilla" });
    const post = f.mock.calls.map((_c, i) => llamada(f, i)).find((c) => c.init.method === "POST")!;
    expect(post.body).toEqual({ nombre: "Guion", cuerpo: "Buenos días, le habla…", canal: "LLAMADA" });
  });

  it("al editar no deja cambiar el canal y muestra el error de la API", async () => {
    mockFetch({
      "GET /api/plantillas": ok(PLANTILLAS),
      "/api/plantillas/variables": ok([]),
      "PATCH /api/plantillas/2": falla(422, "El mensaje es muy corto"),
    });
    render(<PlantillasPage />);
    await screen.findByText("Mi WhatsApp");
    await userEvent.click(within(tarjeta("Mi WhatsApp")).getByRole("button", { name: "Editar" }));

    expect(screen.getByRole("heading", { name: "Editar plantilla" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Canal" })).toBeDisabled();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Mi WhatsApp");

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El mensaje es muy corto");

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("heading", { name: "Editar plantilla" })).not.toBeInTheDocument();
  });

  it("si la lista no carga lo avisa", async () => {
    mockFetch({ "/api/plantillas": falla(500, "caída") });
    render(<PlantillasPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar las plantillas.caída");
  });
});

