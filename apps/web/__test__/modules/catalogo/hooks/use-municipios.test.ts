import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { falla, mockFetch, ok } from "../../../helpers/http";

const MEDELLIN = { codigo: "05001", nombre: "Medellín", departamento: "Antioquia", codigoDepartamento: "05" };

async function hook() {
  vi.resetModules();
  return (await import("@/modules/catalogo")).useMunicipios;
}

describe("useMunicipios", () => {
  it("sin departamento no pide nada", async () => {
    const f = mockFetch();
    const useMunicipios = await hook();
    const { result } = renderHook(() => useMunicipios(""));
    expect(result.current).toEqual({ estado: "sin-departamento" });
    expect(f).not.toHaveBeenCalled();
  });

  it("pasa de cargando a listo y recarga al cambiar de departamento", async () => {
    mockFetch({ "/api/catalogo/municipios": (url) => ok(url.searchParams.get("departamento") === "05" ? [MEDELLIN] : []) });
    const useMunicipios = await hook();
    const { result, rerender } = renderHook(({ dep }) => useMunicipios(dep), { initialProps: { dep: "05" } });

    expect(result.current).toEqual({ estado: "cargando" });
    await waitFor(() => expect(result.current).toEqual({ estado: "listo", municipios: [MEDELLIN] }));

    rerender({ dep: "08" });
    expect(result.current).toEqual({ estado: "cargando" });
    await waitFor(() => expect(result.current).toEqual({ estado: "listo", municipios: [] }));
  });

  it("queda en error si la API falla", async () => {
    mockFetch({ "/api/catalogo/municipios": falla(500, "caída") });
    const useMunicipios = await hook();
    const { result } = renderHook(() => useMunicipios("05"));
    await waitFor(() => expect(result.current).toEqual({ estado: "error" }));
  });
});
