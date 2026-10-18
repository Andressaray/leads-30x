import { beforeEach, describe, expect, it, vi } from "vitest";
import { session } from "../../helpers/fixtures";

const KEY = "leads_session";

// The store keeps the session in memory when it reads it the first time, so each test uses a fresh module.
async function newStore() {
  vi.resetModules();
  return (await import("@/shared/lib/session-store")).sessionStore;
}

describe("sessionStore", () => {
  beforeEach(() => localStorage.clear());

  it("with nothing stored it returns null", async () => {
    const store = await newStore();
    expect(store.get()).toBeNull();
  });

  it("restores the session stored in localStorage", async () => {
    localStorage.setItem(KEY, JSON.stringify(session()));
    const store = await newStore();
    expect(store.get()).toEqual(session());
  });

  it.each([
    ["JSON roto", "{no es json"],
    ["sin token", JSON.stringify({ user: { id: 1 } })],
    ["id no numérico", JSON.stringify({ token: "t", user: { id: "1" } })],
  ])("ignores an invalid stored session (%s)", async (_case, raw) => {
    localStorage.setItem(KEY, raw);
    const store = await newStore();
    expect(store.get()).toBeNull();
  });

  it("set stores it and notifies subscribers, and clear removes it", async () => {
    const store = await newStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set(session());
    expect(store.get()).toEqual(session());
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(session());
    expect(listener).toHaveBeenCalledTimes(1);

    store.clear();
    expect(store.get()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.set(session());
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("if localStorage fails, the session stays in memory", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    const store = await newStore();
    store.set(session());
    expect(store.get()).toEqual(session());
  });
});
