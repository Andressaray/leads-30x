import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sessionStore } from "@/shared/lib/session-store";
import { resultadoBusqueda, sesion } from "../../helpers/fixtures";
import { falla, mockFetch, ok } from "../../helpers/http";

// La búsqueda real consulta cada 2 s; aquí el servicio se controla desde el test.
const crearBusqueda = vi.hoisted(() => vi.fn());
vi.mock("@/modules/busquedas/services/busquedas.service", () => ({ crearBusqueda }));

const DEPARTAMENTOS = [{ codigo: "05", nombre: "Antioquia" }];
const CATEGORIAS = [{ clave: "restaurantes", nombre: "Restaurantes" }];
const MUNICIPIOS = [{ codigo: "05001", nombre: "Medellín", departamento: "Antioquia", codigoDepartamento: "05" }];

// El módulo de catálogo guarda en caché: cada prueba usa módulos nuevos.
async function pagina() {
  vi.resetModules();
  const mod = await import("@/modules/busquedas/route");
  const Stub = createRoutesStub([{ path: "/", Component: mod.default, loader: mod.clientLoader, HydrateFallback: mod.HydrateFallback }]);
  return { mod, render: () => render(<Stub initialEntries={["/"]} />) };
}

describe("Buscar leads", () => {
  beforeEach(() => {
    sessionStore.set(sesion());
    crearBusqueda.mockReset();
  });

  it("el loader trae los catálogos y, si uno falla, sigue con el otro", async () => {
    mockFetch({ "/api/catalogo/categorias": falla(500, "caída"), "/api/catalogo/departamentos": ok(DEPARTAMENTOS) });
    const { mod } = await pagina();
    await expect(mod.clientLoader()).resolves.toEqual({ categorias: [], departamentos: DEPARTAMENTOS, errorCatalogo: "caída" });
  });

  it("busca, muestra el progreso y luego el resumen con la tabla", async () => {
    mockFetch({
      "/api/catalogo/categorias": ok(CATEGORIAS),
      "/api/catalogo/departamentos": ok(DEPARTAMENTOS),
      "/api/catalogo/municipios": ok(MUNICIPIOS),
      "/api/leads": ok({ total: 0, pagina: 1, limite: 20, leads: [] }),
    });
    let terminar!: (r: unknown) => void;
    crearBusqueda.mockReturnValue(new Promise((r) => (terminar = r)));
    const { render } = await pagina();
    render();

    await userEvent.selectOptions(await screen.findByLabelText("Departamento"), "05");
    await vi.waitFor(() => expect(screen.getByLabelText("Ciudad")).toBeEnabled());
    await userEvent.selectOptions(screen.getByLabelText("Ciudad"), "05001");
    await userEvent.click(screen.getByRole("button", { name: "Buscar leads" }));

    expect(crearBusqueda).toHaveBeenCalledWith({ codigo: "05001" }, expect.any(AbortSignal));
    expect(screen.getByRole("status")).toHaveTextContent("Buscando leads…");
    expect(screen.getByRole("button", { name: "Buscar leads" })).toBeDisabled();

    terminar(resultadoBusqueda());
    expect(await screen.findByText(/búsqueda #42/)).toBeInTheDocument();
    expect(await screen.findByText("No hay leads para mostrar todavía.")).toBeInTheDocument();
  });

  it("muestra el error de la búsqueda", async () => {
    mockFetch({ "/api/catalogo/categorias": ok(CATEGORIAS), "/api/catalogo/departamentos": ok(DEPARTAMENTOS), "/api/catalogo/municipios": ok(MUNICIPIOS) });
    crearBusqueda.mockRejectedValue(new Error("Sin conexión"));
    const { render } = await pagina();
    render();
    await userEvent.selectOptions(await screen.findByLabelText("Departamento"), "05");
    await vi.waitFor(() => expect(screen.getByLabelText("Ciudad")).toBeEnabled());
    await userEvent.selectOptions(screen.getByLabelText("Ciudad"), "05001");
    await userEvent.click(screen.getByRole("button", { name: "Buscar leads" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo completar la búsqueda.Sin conexión");
  });
});
