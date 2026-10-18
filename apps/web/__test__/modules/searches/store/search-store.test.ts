import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessionStore } from "@/shared/lib/session-store";
import { searchResult, session } from "../../../helpers/fixtures";

// The store is isolated from the service: here we test how it turns results and errors into states.
const createSearch = vi.hoisted(() => vi.fn());
vi.mock("@/modules/searches/services/searches.service", () => ({ createSearch }));

const { searchStore } = await import("@/modules/searches/store/search-store");
const { ApiError } = await import("@/shared/lib/http");

describe("searchStore", () => {
  beforeEach(() => sessionStore.set(session()));
  afterEach(() => createSearch.mockReset());

  it("starts empty", () => {
    expect(searchStore.get()).toEqual({
      form: { department: "", code: "", category: "" },
      search: { status: "inactiva" },
      page: 1,
    });
  });

  it("stores the form and the page per user in sessionStorage", () => {
    const listener = vi.fn();
    const unsubscribe = searchStore.subscribe(listener);
    searchStore.setForm({ department: "05" });
    searchStore.setForm({ code: "05001" });
    searchStore.setPage(3);
    unsubscribe();

    expect(searchStore.get().form).toEqual({ department: "05", code: "05001", category: "" });
    expect(listener).toHaveBeenCalledTimes(3);
    expect(JSON.parse(sessionStorage.getItem("leads_search:7")!)).toMatchObject({ page: 3, form: { code: "05001" } });
  });

  it("search goes through 'searching' and ends up 'ready' with the result (back to page 1)", async () => {
    searchStore.setPage(4);
    let resolve!: (r: unknown) => void;
    createSearch.mockReturnValue(new Promise((r) => (resolve = r)));

    const promise = searchStore.runSearch({ code: "05001" });
    expect(searchStore.get().search).toEqual({ status: "searching" });
    expect(searchStore.get().page).toBe(1);

    resolve(searchResult());
    await promise;
    expect(searchStore.get().search).toEqual({ status: "list", result: searchResult() });
  });

  it("if every source fails it lists which ones and why", async () => {
    createSearch.mockRejectedValue(
      new ApiError(502, "Ninguna fuente respondió.", { bySource: { dane: { error: "timeout" }, osm: { error: null }, rnt: { error: "500" } } }),
    );
    await searchStore.runSearch({ code: "05001" });
    expect(searchStore.get().search).toEqual({
      status: "error",
      title: "Ninguna fuente respondió.",
      details: ["DANE: timeout", "RNT: 500"],
    });
  });

  it("if the city is ambiguous it shows the candidates", async () => {
    createSearch.mockRejectedValue(
      new ApiError(409, "Hay varias ciudades con ese nombre.", { candidates: [{ name: "Barbosa", department: "Antioquia" }, { name: "Barbosa", department: "Santander" }] }),
    );
    await searchStore.runSearch({ code: "barbosa" });
    expect(searchStore.get().search).toEqual({
      status: "error",
      title: "Hay varias ciudades con ese nombre.",
      details: ["Barbosa (Antioquia)", "Barbosa (Santander)"],
    });
  });

  it("any other error ends up with a generic title and the message", async () => {
    createSearch.mockRejectedValue(new TypeError("Failed to fetch"));
    await searchStore.runSearch({ code: "05001" });
    expect(searchStore.get().search).toEqual({ status: "error", title: "No se pudo completar la búsqueda.", details: ["Failed to fetch"] });
  });

  it("a new search cancels the previous one and its result does not overwrite the new one", async () => {
    const signals: AbortSignal[] = [];
    const resolvers: Array<(r: unknown) => void> = [];
    createSearch.mockImplementation((_d: unknown, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise((r) => resolvers.push(r));
    });

    const first = searchStore.runSearch({ code: "05001" });
    const second = searchStore.runSearch({ code: "11001" });
    expect(signals[0].aborted).toBe(true);

    resolvers[1](searchResult({ searchId: 2 }));
    resolvers[0](searchResult({ searchId: 1 }));
    await Promise.all([first, second]);

    expect(searchStore.get().search).toMatchObject({ status: "list", result: { searchId: 2 } });
  });

  it("logging out stops the search in progress and clears everything", async () => {
    let signal!: AbortSignal;
    createSearch.mockImplementation((_d: unknown, s: AbortSignal) => {
      signal = s;
      return new Promise(() => {});
    });
    searchStore.setForm({ department: "05" });
    void searchStore.runSearch({ code: "05001" });

    sessionStore.clear();

    expect(signal.aborted).toBe(true);
    expect(sessionStorage.getItem("leads_search:7")).toBeNull();
    expect(searchStore.get().search).toEqual({ status: "inactiva" });
  });

  it("each user sees their own search", () => {
    searchStore.setForm({ department: "05" });
    sessionStore.set(session({ id: 8 }));
    expect(searchStore.get().form.department).toBe("");
    sessionStore.set(session({ id: 7 }));
    expect(searchStore.get().form.department).toBe("05");
  });

  it("if the tab was reloaded in the middle of a search, it goes back to 'idle'", () => {
    sessionStore.set(session({ id: 20 }));
    sessionStorage.setItem(
      "leads_search:21",
      JSON.stringify({ form: { department: "05", code: "05001", category: "" }, search: { status: "searching" }, page: 1 }),
    );
    sessionStore.set(session({ id: 21 }));
    expect(searchStore.get()).toMatchObject({ form: { code: "05001" }, search: { status: "inactiva" } });
  });

  it("ignores the stored data if it is corrupted", () => {
    sessionStore.set(session({ id: 30 }));
    sessionStorage.setItem("leads_search:31", "{dañado");
    sessionStore.set(session({ id: 31 }));
    expect(searchStore.get().search).toEqual({ status: "inactiva" });
  });
});
