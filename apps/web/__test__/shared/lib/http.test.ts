import { describe, expect, it, vi } from "vitest";
import { ApiError, apiUrl, http, errorMessage, request, requestBlob } from "@/shared/lib/http";
import { sessionStore } from "@/shared/lib/session-store";
import { session } from "../../helpers/fixtures";
import { failure, call, mockFetch, ok, response } from "../../helpers/http";

describe("apiUrl", () => {
  it("builds the query without the empty values", () => {
    expect(apiUrl("/api/leads", { page: 2, q: "café", empty: "", null_: null, indef: undefined, mine: false })).toBe(
      "/api/leads?page=2&q=caf%C3%A9&mine=false",
    );
  });

  it("without a query it does not add '?'", () => {
    expect(apiUrl("/api/leads")).toBe("/api/leads");
    expect(apiUrl("/api/leads", {})).toBe("/api/leads");
  });

  it("uses VITE_API_URL as the base (without the trailing slash)", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.ejemplo.co/");
    vi.resetModules();
    const { apiUrl: withBase } = await import("@/shared/lib/http");
    expect(withBase("/api/leads", { page: 1 })).toBe("https://api.ejemplo.co/api/leads?page=1");
  });
});

describe("request", () => {
  it("returns `data` from the API envelope", async () => {
    mockFetch({ "/api/x": ok({ a: 1 }) });
    await expect(request("/api/x")).resolves.toEqual({ a: 1 });
  });

  it("sends the session token and the body as JSON", async () => {
    sessionStore.set(session());
    const f = mockFetch({ "POST /api/x": ok(null, 201) });

    await http.post("/api/x", { name: "a" });

    const { init, headers, body } = call(f);
    expect(init.method).toBe("POST");
    expect(headers).toEqual({ Authorization: "Bearer test-token", "Content-Type": "application/json" });
    expect(body).toEqual({ name: "a" });
  });

  it("without a session or a body it sends no headers", async () => {
    const f = mockFetch({ "/api/x": ok([]) });
    await http.get("/api/x", { page: 3 });
    const { url, headers, init } = call(f);
    expect(url.search).toBe("?page=3");
    expect(headers).toEqual({});
    expect(init.body).toBeUndefined();
  });

  it("if it is not 2xx it throws ApiError with the API message and details", async () => {
    mockFetch({ "/api/x": failure(409, "Ciudad ambigua", { candidates: [] }) });
    const err = await request("/api/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, message: "Ciudad ambigua", details: { candidates: [] } });
  });

  it("if the error has no JSON it uses 'HTTP <status>'", async () => {
    mockFetch({ "/api/x": new Response("<html>", { status: 500 }) });
    await expect(request("/api/x")).rejects.toMatchObject({ status: 500, message: "HTTP 500" });
  });

  it("a 401 with a session closes it", async () => {
    sessionStore.set(session());
    mockFetch({ "/api/x": failure(401, "Token vencido") });
    await expect(request("/api/x")).rejects.toMatchObject({ status: 401 });
    expect(sessionStore.get()).toBeNull();
  });

  it("other errors do not touch the session", async () => {
    sessionStore.set(session());
    mockFetch({ "/api/x": failure(403, "Prohibido") });
    await expect(request("/api/x")).rejects.toThrow("Prohibido");
    expect(sessionStore.get()).not.toBeNull();
  });
});

describe("requestBlob", () => {
  it("returns the body as a Blob", async () => {
    mockFetch({ "/api/x.csv": new Response("a,b\n1,2", { status: 200 }) });
    const blob = await requestBlob("/api/x.csv");
    await expect(blob.text()).resolves.toBe("a,b\n1,2");
  });

  it("if it fails it throws ApiError with the API message", async () => {
    mockFetch({ "/api/x.csv": response(404, { error: "Búsqueda no encontrada" }) });
    await expect(requestBlob("/api/x.csv")).rejects.toMatchObject({ status: 404, message: "Búsqueda no encontrada" });
  });
});

describe("errorMessage", () => {
  it("uses the message of an Error and converts anything else to text", () => {
    expect(errorMessage(new Error("falló"))).toBe("falló");
    expect(errorMessage("text")).toBe("text");
    expect(errorMessage(404)).toBe("404");
  });
});
