import { beforeEach, describe, expect, it, vi } from "vitest";
import { sesion } from "../../helpers/fixtures";

const CLAVE = "leads_sesion";

// El store guarda la sesión en memoria al leerla por primera vez, así que cada prueba usa un módulo nuevo.
async function storeNuevo() {
  vi.resetModules();
  return (await import("@/shared/lib/session-store")).sessionStore;
}

describe("sessionStore", () => {
  beforeEach(() => localStorage.clear());

  it("sin nada guardado devuelve null", async () => {
    const store = await storeNuevo();
    expect(store.get()).toBeNull();
  });

  it("recupera la sesión guardada en localStorage", async () => {
    localStorage.setItem(CLAVE, JSON.stringify(sesion()));
    const store = await storeNuevo();
    expect(store.get()).toEqual(sesion());
  });

  it.each([
    ["JSON roto", "{no es json"],
    ["sin token", JSON.stringify({ usuario: { id: 1 } })],
    ["id no numérico", JSON.stringify({ token: "t", usuario: { id: "1" } })],
  ])("ignora una sesión guardada inválida (%s)", async (_caso, crudo) => {
    localStorage.setItem(CLAVE, crudo);
    const store = await storeNuevo();
    expect(store.get()).toBeNull();
  });

  it("set guarda, avisa a los suscriptores y clear la borra", async () => {
    const store = await storeNuevo();
    const oyente = vi.fn();
    const desuscribir = store.subscribe(oyente);

    store.set(sesion());
    expect(store.get()).toEqual(sesion());
    expect(JSON.parse(localStorage.getItem(CLAVE)!)).toEqual(sesion());
    expect(oyente).toHaveBeenCalledTimes(1);

    store.clear();
    expect(store.get()).toBeNull();
    expect(localStorage.getItem(CLAVE)).toBeNull();
    expect(oyente).toHaveBeenCalledTimes(2);

    desuscribir();
    store.set(sesion());
    expect(oyente).toHaveBeenCalledTimes(2);
  });

  it("si localStorage falla, la sesión queda en memoria", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    const store = await storeNuevo();
    store.set(sesion());
    expect(store.get()).toEqual(sesion());
  });
});
