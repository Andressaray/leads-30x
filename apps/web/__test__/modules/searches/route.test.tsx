import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sessionStore } from "@/shared/lib/session-store";
import { searchResult, session } from "../../helpers/fixtures";
import { failure, mockFetch, ok } from "../../helpers/http";

// The real search polls every 2 s; here the service is controlled from the test.
const createSearch = vi.hoisted(() => vi.fn());
vi.mock("@/modules/searches/services/searches.service", () => ({ createSearch }));

const DEPARTMENTS = [{ code: "05", name: "Antioquia" }];
const CATEGORIES = [{ key: "restaurantes", name: "Restaurantes" }];
const MUNICIPALITIES = [{ code: "05001", name: "Medellín", department: "Antioquia", departmentCode: "05" }];

// The catalog module caches: each test uses fresh modules.
async function page() {
  vi.resetModules();
  const mod = await import("@/modules/searches/route");
  const Stub = createRoutesStub([{ path: "/", Component: mod.default, loader: mod.clientLoader, HydrateFallback: mod.HydrateFallback }]);
  return { mod, render: () => render(<Stub initialEntries={["/"]} />) };
}

describe("Search leads", () => {
  beforeEach(() => {
    sessionStore.set(session());
    createSearch.mockReset();
  });

  it("the loader brings the catalogs and, if one fails, continues with the other", async () => {
    mockFetch({ "/api/catalog/categories": failure(500, "caída"), "/api/catalog/departments": ok(DEPARTMENTS) });
    const { mod } = await page();
    await expect(mod.clientLoader()).resolves.toEqual({ categories: [], departments: DEPARTMENTS, catalogError: "caída" });
  });

  it("searches, shows the progress and then the summary with the table", async () => {
    mockFetch({
      "/api/catalog/categories": ok(CATEGORIES),
      "/api/catalog/departments": ok(DEPARTMENTS),
      "/api/catalog/municipalities": ok(MUNICIPALITIES),
      "/api/leads": ok({ total: 0, page: 1, limit: 20, leads: [] }),
    });
    let finish!: (r: unknown) => void;
    createSearch.mockReturnValue(new Promise((r) => (finish = r)));
    const { render } = await page();
    render();

    await userEvent.selectOptions(await screen.findByLabelText("Departamento"), "05");
    await vi.waitFor(() => expect(screen.getByLabelText("Ciudad")).toBeEnabled());
    await userEvent.selectOptions(screen.getByLabelText("Ciudad"), "05001");
    await userEvent.click(screen.getByRole("button", { name: "Buscar leads" }));

    expect(createSearch).toHaveBeenCalledWith({ code: "05001" }, expect.any(AbortSignal));
    expect(screen.getByRole("status")).toHaveTextContent("Buscando leads…");
    expect(screen.getByRole("button", { name: "Buscar leads" })).toBeDisabled();

    finish(searchResult());
    expect(await screen.findByText(/búsqueda #42/)).toBeInTheDocument();
    expect(await screen.findByText("No hay leads para mostrar todavía.")).toBeInTheDocument();
  });

  it("shows the search error", async () => {
    mockFetch({ "/api/catalog/categories": ok(CATEGORIES), "/api/catalog/departments": ok(DEPARTMENTS), "/api/catalog/municipalities": ok(MUNICIPALITIES) });
    createSearch.mockRejectedValue(new Error("Sin conexión"));
    const { render } = await page();
    render();
    await userEvent.selectOptions(await screen.findByLabelText("Departamento"), "05");
    await vi.waitFor(() => expect(screen.getByLabelText("Ciudad")).toBeEnabled());
    await userEvent.selectOptions(screen.getByLabelText("Ciudad"), "05001");
    await userEvent.click(screen.getByRole("button", { name: "Buscar leads" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo completar la búsqueda.Sin conexión");
  });
});
