import { describe, expect, it } from "vitest";
import { logout, login, listMembers } from "@/modules/auth";
import { safePath } from "@/modules/auth/services/auth.service";
import { sessionStore } from "@/shared/lib/session-store";
import { session } from "../../../helpers/fixtures";
import { failure, call, mockFetch, ok } from "../../../helpers/http";

describe("iniciarSesion / cerrarSesion", () => {
  it("stores the session returned by the API", async () => {
    const f = mockFetch({ "POST /api/auth/login": ok(session()) });

    await expect(login({ email: "andres@leads.co", password: "secreta" })).resolves.toEqual(session());

    expect(call(f).body).toEqual({ email: "andres@leads.co", password: "secreta" });
    expect(sessionStore.get()).toEqual(session());

    logout();
    expect(sessionStore.get()).toBeNull();
  });

  it("with bad credentials it stores nothing", async () => {
    mockFetch({ "POST /api/auth/login": failure(401, "Credenciales inválidas") });
    await expect(login({ email: "a@b.co", password: "x" })).rejects.toThrow("Credenciales inválidas");
    expect(sessionStore.get()).toBeNull();
  });
});

describe("listMembers", () => {
  it("requests the members with the token", async () => {
    sessionStore.set(session());
    const members = [{ id: 2, fullName: "Ana", email: "ana@leads.co", contacted: 4 }];
    const f = mockFetch({ "/api/users/members": ok(members) });
    await expect(listMembers()).resolves.toEqual(members);
    expect(call(f).headers.Authorization).toBe("Bearer test-token");
  });
});

describe("safePath", () => {
  it.each([
    ["/contacted?team=1", "/contacted?team=1"],
    ["/metrics", "/metrics"],
    [null, "/"],
    ["", "/"],
    ["https://malo.com", "/"],
    ["//malo.com", "/"],
    ["/login", "/"],
    ["/login?returnTo=/x", "/"],
    ["javascript:alert(1)", "/"],
  ])("%j → %s", (destination, expected) => {
    expect(safePath(destination)).toBe(expected);
  });
});
