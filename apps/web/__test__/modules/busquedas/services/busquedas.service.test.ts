import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearBusqueda } from "@/modules/busquedas";
import type { BusquedaGuardada } from "@/modules/busquedas";
import { ApiError } from "@/shared/lib/http";
import { llamada, mockFetch, ok } from "../../../helpers/http";

const guardada = (cambios: Partial<BusquedaGuardada> = {}): BusquedaGuardada => ({
  id: 9,
  codMpio: "05001",
  municipio: "Medellín",
  departamento: "Antioquia",
  filtros: { nombre: "Restaurantes", categoria: "restaurantes" },
  estado: "en_curso",
  resumen: null,
  ...cambios,
});

const RESUMEN = { leads: 12, nuevos: 3, contactables: 8, enVariasFuentes: 2, porFuente: {} };

/** Responde a GET /api/busquedas/9 con los estados en orden (el último se repite). */
function api(estados: BusquedaGuardada[]) {
  let i = 0;
  return mockFetch({
    "POST /api/busquedas": ok({ busquedaId: 9, estado: "en_curso", enCola: 0 }, 202),
    "GET /api/busquedas/9": () => ok(estados[Math.min(i++, estados.length - 1)]),
  });
}

describe("crearBusqueda", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("lanza la búsqueda asíncrona y consulta cada 2 s hasta que termina", async () => {
    const f = api([guardada(), guardada(), guardada({ estado: "completa", resumen: RESUMEN })]);

    const promesa = crearBusqueda({ codigo: "05001", categoria: "restaurantes" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(f).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4000);

    await expect(promesa).resolves.toEqual({
      busquedaId: 9,
      estado: "completa",
      municipio: { codigo: "05001", nombre: "Medellín", departamento: "Antioquia" },
      filtros: { nombre: "Restaurantes", categoria: "restaurantes" },
      resumen: RESUMEN,
      leadsTotal: 12,
      leads: [],
    });
    expect(llamada(f).body).toEqual({ codigo: "05001", categoria: "restaurantes", asincrona: true });
    expect(f).toHaveBeenCalledTimes(4);
  });

  it("una búsqueda parcial también se devuelve (y sin resumen queda en ceros)", async () => {
    api([guardada({ estado: "parcial", resumen: null })]);
    const promesa = crearBusqueda({ codigo: "05001" });
    await vi.advanceTimersByTimeAsync(2000);
    await expect(promesa).resolves.toMatchObject({ estado: "parcial", leadsTotal: 0, resumen: { leads: 0, porFuente: {} } });
  });

  it("si falla en todas las fuentes lanza 502 con el detalle por fuente", async () => {
    const porFuente = { dane: { estado: "error", registros: 0, nuevos: 0, enriquecidos: 0, error: "timeout" } };
    api([guardada({ estado: "fallida", resumen: { ...RESUMEN, porFuente } as BusquedaGuardada["resumen"] })]);

    const promesa = crearBusqueda({ codigo: "05001" }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(2000);

    const err = await promesa;
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 502, details: { porFuente } });
  });

  it("después de 10 minutos en curso se rinde con 504", async () => {
    api([guardada()]);
    const promesa = crearBusqueda({ codigo: "05001" }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 2000);
    expect(await promesa).toMatchObject({ status: 504, message: expect.stringContaining("#9") });
  });

  it("si se aborta deja de consultar", async () => {
    const f = api([guardada()]);
    const control = new AbortController();
    const promesa = crearBusqueda({ codigo: "05001" }, control.signal).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(2000);
    const llamadas = f.mock.calls.length;

    control.abort(new DOMException("cancelada", "AbortError"));
    expect(await promesa).toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(f).toHaveBeenCalledTimes(llamadas);
  });
});
