import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLeads } from "@/modules/leads/hooks/use-leads";
import type { FiltrosLeads } from "@/modules/leads";
import { lead } from "../../../helpers/fixtures";
import { falla, mockFetch, ok } from "../../../helpers/http";

/** API de leads que responde con la página pedida. */
function apiLeads() {
  return mockFetch({
    "/api/leads": (url) => ok({ total: 45, pagina: Number(url.searchParams.get("pagina")), limite: 20, leads: [lead()] }),
  });
}

const query = (f: ReturnType<typeof mockFetch>, i: number) => Object.fromEntries(new URL(String(f.mock.calls[i][0]), "http://x").searchParams);

describe("useLeads", () => {
  it("pide la página 1 con los filtros y el límite de la tabla", async () => {
    const f = apiLeads();
    const { result } = renderHook(() => useLeads({ busqueda: 42, contactable: true }));

    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.datos?.total).toBe(45);
    expect(result.current.error).toBeNull();
    expect(query(f, 0)).toEqual({ busqueda: "42", contactable: "true", pagina: "1", limite: "20" });
  });

  it("cambiar de página la pide y, al cambiar los filtros, vuelve a la 1", async () => {
    const f = apiLeads();
    const { result, rerender } = renderHook(({ filtros }: { filtros: FiltrosLeads }) => useLeads(filtros), {
      initialProps: { filtros: { busqueda: 1 } },
    });
    await waitFor(() => expect(result.current.cargando).toBe(false));

    act(() => result.current.setPagina(3));
    await waitFor(() => expect(result.current.datos?.pagina).toBe(3));
    expect(result.current.pagina).toBe(3);

    rerender({ filtros: { busqueda: 2 } });
    expect(result.current.pagina).toBe(1);
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(query(f, f.mock.calls.length - 1)).toMatchObject({ busqueda: "2", pagina: "1" });
  });

  it("con página controlada desde afuera avisa el cambio en vez de guardarlo", async () => {
    apiLeads();
    const onCambiarPagina = vi.fn();
    const { result } = renderHook(() => useLeads({}, { pagina: 2, onCambiarPagina }));
    await waitFor(() => expect(result.current.datos?.pagina).toBe(2));
    act(() => result.current.setPagina(3));
    expect(onCambiarPagina).toHaveBeenCalledWith(3);
    expect(result.current.pagina).toBe(2);
  });

  it("recargar vuelve a pedir y conserva los datos mientras carga", async () => {
    const f = apiLeads();
    const { result } = renderHook(() => useLeads({}));
    await waitFor(() => expect(result.current.cargando).toBe(false));

    act(() => result.current.recargar());
    expect(result.current.cargando).toBe(true);
    expect(result.current.datos).not.toBeNull();
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("expone el error de la API", async () => {
    mockFetch({ "/api/leads": falla(500, "Base caída") });
    const { result } = renderHook(() => useLeads({}));
    await waitFor(() => expect(result.current.error).toBe("Base caída"));
    expect(result.current.datos).toBeNull();
  });
});
