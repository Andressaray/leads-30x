import { describe, expect, it } from "vitest";
import { cerrarSesion, iniciarSesion, listarMiembros } from "@/modules/auth";
import { rutaSegura } from "@/modules/auth/services/auth.service";
import { sessionStore } from "@/shared/lib/session-store";
import { sesion } from "../../../helpers/fixtures";
import { falla, llamada, mockFetch, ok } from "../../../helpers/http";

describe("iniciarSesion / cerrarSesion", () => {
  it("guarda la sesión que devuelve la API", async () => {
    const f = mockFetch({ "POST /api/auth/login": ok(sesion()) });

    await expect(iniciarSesion({ email: "andres@leads.co", password: "secreta" })).resolves.toEqual(sesion());

    expect(llamada(f).body).toEqual({ email: "andres@leads.co", password: "secreta" });
    expect(sessionStore.get()).toEqual(sesion());

    cerrarSesion();
    expect(sessionStore.get()).toBeNull();
  });

  it("con credenciales malas no guarda nada", async () => {
    mockFetch({ "POST /api/auth/login": falla(401, "Credenciales inválidas") });
    await expect(iniciarSesion({ email: "a@b.co", password: "x" })).rejects.toThrow("Credenciales inválidas");
    expect(sessionStore.get()).toBeNull();
  });
});

describe("listarMiembros", () => {
  it("pide los miembros con el token", async () => {
    sessionStore.set(sesion());
    const miembros = [{ id: 2, fullName: "Ana", email: "ana@leads.co", contactados: 4 }];
    const f = mockFetch({ "/api/usuarios/miembros": ok(miembros) });
    await expect(listarMiembros()).resolves.toEqual(miembros);
    expect(llamada(f).headers.Authorization).toBe("Bearer token-de-prueba");
  });
});

describe("rutaSegura", () => {
  it.each([
    ["/contactados?equipo=1", "/contactados?equipo=1"],
    ["/metricas", "/metricas"],
    [null, "/"],
    ["", "/"],
    ["https://malo.com", "/"],
    ["//malo.com", "/"],
    ["/login", "/"],
    ["/login?volver=/x", "/"],
    ["javascript:alert(1)", "/"],
  ])("%j → %s", (destino, esperado) => {
    expect(rutaSegura(destino)).toBe(esperado);
  });
});
