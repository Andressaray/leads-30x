import { describe, expect, it, vi } from "vitest";
import { ApiError, apiUrl, http, mensajeDeError, request, requestBlob } from "@/shared/lib/http";
import { sessionStore } from "@/shared/lib/session-store";
import { sesion } from "../../helpers/fixtures";
import { falla, llamada, mockFetch, ok, respuesta } from "../../helpers/http";

describe("apiUrl", () => {
  it("arma la query sin los valores vacíos", () => {
    expect(apiUrl("/api/leads", { pagina: 2, q: "café", vacio: "", nulo: null, indef: undefined, mios: false })).toBe(
      "/api/leads?pagina=2&q=caf%C3%A9&mios=false",
    );
  });

  it("sin query no agrega '?'", () => {
    expect(apiUrl("/api/leads")).toBe("/api/leads");
    expect(apiUrl("/api/leads", {})).toBe("/api/leads");
  });

  it("usa VITE_API_URL como base (sin la barra final)", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.ejemplo.co/");
    vi.resetModules();
    const { apiUrl: conBase } = await import("@/shared/lib/http");
    expect(conBase("/api/leads", { pagina: 1 })).toBe("https://api.ejemplo.co/api/leads?pagina=1");
  });
});

describe("request", () => {
  it("devuelve `data` del sobre de la API", async () => {
    mockFetch({ "/api/x": ok({ a: 1 }) });
    await expect(request("/api/x")).resolves.toEqual({ a: 1 });
  });

  it("manda el token de la sesión y el cuerpo como JSON", async () => {
    sessionStore.set(sesion());
    const f = mockFetch({ "POST /api/x": ok(null, 201) });

    await http.post("/api/x", { nombre: "a" });

    const { init, headers, body } = llamada(f);
    expect(init.method).toBe("POST");
    expect(headers).toEqual({ Authorization: "Bearer token-de-prueba", "Content-Type": "application/json" });
    expect(body).toEqual({ nombre: "a" });
  });

  it("sin sesión ni cuerpo no manda encabezados", async () => {
    const f = mockFetch({ "/api/x": ok([]) });
    await http.get("/api/x", { pagina: 3 });
    const { url, headers, init } = llamada(f);
    expect(url.search).toBe("?pagina=3");
    expect(headers).toEqual({});
    expect(init.body).toBeUndefined();
  });

  it("si no es 2xx lanza ApiError con el mensaje y los detalles de la API", async () => {
    mockFetch({ "/api/x": falla(409, "Ciudad ambigua", { candidatos: [] }) });
    const err = await request("/api/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, message: "Ciudad ambigua", details: { candidatos: [] } });
  });

  it("si el error no trae JSON usa 'HTTP <status>'", async () => {
    mockFetch({ "/api/x": new Response("<html>", { status: 500 }) });
    await expect(request("/api/x")).rejects.toMatchObject({ status: 500, message: "HTTP 500" });
  });

  it("un 401 con sesión la cierra", async () => {
    sessionStore.set(sesion());
    mockFetch({ "/api/x": falla(401, "Token vencido") });
    await expect(request("/api/x")).rejects.toMatchObject({ status: 401 });
    expect(sessionStore.get()).toBeNull();
  });

  it("otros errores no tocan la sesión", async () => {
    sessionStore.set(sesion());
    mockFetch({ "/api/x": falla(403, "Prohibido") });
    await expect(request("/api/x")).rejects.toThrow("Prohibido");
    expect(sessionStore.get()).not.toBeNull();
  });
});

describe("requestBlob", () => {
  it("devuelve el cuerpo como Blob", async () => {
    mockFetch({ "/api/x.csv": new Response("a,b\n1,2", { status: 200 }) });
    const blob = await requestBlob("/api/x.csv");
    await expect(blob.text()).resolves.toBe("a,b\n1,2");
  });

  it("si falla lanza ApiError con el mensaje de la API", async () => {
    mockFetch({ "/api/x.csv": respuesta(404, { error: "Búsqueda no encontrada" }) });
    await expect(requestBlob("/api/x.csv")).rejects.toMatchObject({ status: 404, message: "Búsqueda no encontrada" });
  });
});

describe("mensajeDeError", () => {
  it("usa el mensaje de un Error y convierte lo demás a texto", () => {
    expect(mensajeDeError(new Error("falló"))).toBe("falló");
    expect(mensajeDeError("texto")).toBe("texto");
    expect(mensajeDeError(404)).toBe("404");
  });
});
