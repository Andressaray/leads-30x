import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessionStore } from "@/shared/lib/session-store";
import { resultadoBusqueda, sesion } from "../../../helpers/fixtures";

// El store se aísla del servicio: aquí se prueba cómo traduce resultados y errores a estados.
const crearBusqueda = vi.hoisted(() => vi.fn());
vi.mock("@/modules/busquedas/services/busquedas.service", () => ({ crearBusqueda }));

const { busquedaStore } = await import("@/modules/busquedas/store/busqueda-store");
const { ApiError } = await import("@/shared/lib/http");

describe("busquedaStore", () => {
  beforeEach(() => sessionStore.set(sesion()));
  afterEach(() => crearBusqueda.mockReset());

  it("empieza vacío", () => {
    expect(busquedaStore.get()).toEqual({
      form: { departamento: "", codigo: "", categoria: "" },
      busqueda: { estado: "inactiva" },
      pagina: 1,
    });
  });

  it("guarda el formulario y la página por usuario en sessionStorage", () => {
    const oyente = vi.fn();
    const desuscribir = busquedaStore.subscribe(oyente);
    busquedaStore.setForm({ departamento: "05" });
    busquedaStore.setForm({ codigo: "05001" });
    busquedaStore.setPagina(3);
    desuscribir();

    expect(busquedaStore.get().form).toEqual({ departamento: "05", codigo: "05001", categoria: "" });
    expect(oyente).toHaveBeenCalledTimes(3);
    expect(JSON.parse(sessionStorage.getItem("leads_busqueda:7")!)).toMatchObject({ pagina: 3, form: { codigo: "05001" } });
  });

  it("buscar pasa por 'buscando' y queda 'lista' con el resultado (volviendo a la página 1)", async () => {
    busquedaStore.setPagina(4);
    let resolver!: (r: unknown) => void;
    crearBusqueda.mockReturnValue(new Promise((r) => (resolver = r)));

    const promesa = busquedaStore.buscar({ codigo: "05001" });
    expect(busquedaStore.get().busqueda).toEqual({ estado: "buscando" });
    expect(busquedaStore.get().pagina).toBe(1);

    resolver(resultadoBusqueda());
    await promesa;
    expect(busquedaStore.get().busqueda).toEqual({ estado: "lista", resultado: resultadoBusqueda() });
  });

  it("si fallan todas las fuentes lista cuáles y por qué", async () => {
    crearBusqueda.mockRejectedValue(
      new ApiError(502, "Ninguna fuente respondió.", { porFuente: { dane: { error: "timeout" }, osm: { error: null }, rnt: { error: "500" } } }),
    );
    await busquedaStore.buscar({ codigo: "05001" });
    expect(busquedaStore.get().busqueda).toEqual({
      estado: "error",
      titulo: "Ninguna fuente respondió.",
      detalles: ["DANE: timeout", "RNT: 500"],
    });
  });

  it("si la ciudad es ambigua muestra los candidatos", async () => {
    crearBusqueda.mockRejectedValue(
      new ApiError(409, "Hay varias ciudades con ese nombre.", { candidatos: [{ nombre: "Barbosa", departamento: "Antioquia" }, { nombre: "Barbosa", departamento: "Santander" }] }),
    );
    await busquedaStore.buscar({ codigo: "barbosa" });
    expect(busquedaStore.get().busqueda).toEqual({
      estado: "error",
      titulo: "Hay varias ciudades con ese nombre.",
      detalles: ["Barbosa (Antioquia)", "Barbosa (Santander)"],
    });
  });

  it("cualquier otro error queda con un título genérico y el mensaje", async () => {
    crearBusqueda.mockRejectedValue(new TypeError("Failed to fetch"));
    await busquedaStore.buscar({ codigo: "05001" });
    expect(busquedaStore.get().busqueda).toEqual({ estado: "error", titulo: "No se pudo completar la búsqueda.", detalles: ["Failed to fetch"] });
  });

  it("una búsqueda nueva cancela la anterior y su resultado no pisa el nuevo", async () => {
    const senales: AbortSignal[] = [];
    const resolvers: Array<(r: unknown) => void> = [];
    crearBusqueda.mockImplementation((_d: unknown, signal: AbortSignal) => {
      senales.push(signal);
      return new Promise((r) => resolvers.push(r));
    });

    const primera = busquedaStore.buscar({ codigo: "05001" });
    const segunda = busquedaStore.buscar({ codigo: "11001" });
    expect(senales[0].aborted).toBe(true);

    resolvers[1](resultadoBusqueda({ busquedaId: 2 }));
    resolvers[0](resultadoBusqueda({ busquedaId: 1 }));
    await Promise.all([primera, segunda]);

    expect(busquedaStore.get().busqueda).toMatchObject({ estado: "lista", resultado: { busquedaId: 2 } });
  });

  it("al cerrar sesión corta la búsqueda en curso y borra todo", async () => {
    let senal!: AbortSignal;
    crearBusqueda.mockImplementation((_d: unknown, s: AbortSignal) => {
      senal = s;
      return new Promise(() => {});
    });
    busquedaStore.setForm({ departamento: "05" });
    void busquedaStore.buscar({ codigo: "05001" });

    sessionStore.clear();

    expect(senal.aborted).toBe(true);
    expect(sessionStorage.getItem("leads_busqueda:7")).toBeNull();
    expect(busquedaStore.get().busqueda).toEqual({ estado: "inactiva" });
  });

  it("cada usuario ve su propia búsqueda", () => {
    busquedaStore.setForm({ departamento: "05" });
    sessionStore.set(sesion({ id: 8 }));
    expect(busquedaStore.get().form.departamento).toBe("");
    sessionStore.set(sesion({ id: 7 }));
    expect(busquedaStore.get().form.departamento).toBe("05");
  });

  it("si la pestaña se recargó a mitad de una búsqueda, vuelve a 'inactiva'", () => {
    sessionStore.set(sesion({ id: 20 }));
    sessionStorage.setItem(
      "leads_busqueda:21",
      JSON.stringify({ form: { departamento: "05", codigo: "05001", categoria: "" }, busqueda: { estado: "buscando" }, pagina: 1 }),
    );
    sessionStore.set(sesion({ id: 21 }));
    expect(busquedaStore.get()).toMatchObject({ form: { codigo: "05001" }, busqueda: { estado: "inactiva" } });
  });

  it("ignora lo guardado si está dañado", () => {
    sessionStore.set(sesion({ id: 30 }));
    sessionStorage.setItem("leads_busqueda:31", "{dañado");
    sessionStore.set(sesion({ id: 31 }));
    expect(busquedaStore.get().busqueda).toEqual({ estado: "inactiva" });
  });
});
