import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSearch } from "@/modules/searches";
import type { SavedSearch } from "@/modules/searches";
import { ApiError } from "@/shared/lib/http";
import { call, mockFetch, ok } from "../../../helpers/http";

const saved = (changes: Partial<SavedSearch> = {}): SavedSearch => ({
  id: 9,
  municipalityCode: "05001",
  municipality: "Medellín",
  department: "Antioquia",
  filters: { name: "Restaurantes", category: "restaurantes" },
  status: "in_progress",
  summary: null,
  ...changes,
});

const SUMMARY = { leads: 12, new: 3, contactables: 8, inMultipleSources: 2, bySource: {} };

/** Responds to GET /api/searches/9 with the statuses in order (the last one repeats). */
function api(statuses: SavedSearch[]) {
  let i = 0;
  return mockFetch({
    "POST /api/searches": ok({ searchId: 9, status: "in_progress", queued: 0 }, 202),
    "GET /api/searches/9": () => ok(statuses[Math.min(i++, statuses.length - 1)]),
  });
}

describe("createSearch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts the async search and polls every 2 s until it finishes", async () => {
    const f = api([saved(), saved(), saved({ status: "complete", summary: SUMMARY })]);

    const promise = createSearch({ code: "05001", category: "restaurantes" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(f).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4000);

    await expect(promise).resolves.toEqual({
      searchId: 9,
      status: "complete",
      municipality: { code: "05001", name: "Medellín", department: "Antioquia" },
      filters: { name: "Restaurantes", category: "restaurantes" },
      summary: SUMMARY,
      leadsTotal: 12,
      leads: [],
    });
    expect(call(f).body).toEqual({ code: "05001", category: "restaurantes", async: true });
    expect(f).toHaveBeenCalledTimes(4);
  });

  it("a partial search is also returned (and without a summary it stays at zero)", async () => {
    api([saved({ status: "partial", summary: null })]);
    const promise = createSearch({ code: "05001" });
    await vi.advanceTimersByTimeAsync(2000);
    await expect(promise).resolves.toMatchObject({ status: "partial", leadsTotal: 0, summary: { leads: 0, bySource: {} } });
  });

  it("if it fails in every source it throws 502 with the detail per source", async () => {
    const bySource = { dane: { status: "error", records: 0, new: 0, enriched: 0, error: "timeout" } };
    api([saved({ status: "failed", summary: { ...SUMMARY, bySource } as SavedSearch["summary"] })]);

    const promise = createSearch({ code: "05001" }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(2000);

    const err = await promise;
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 502, details: { bySource } });
  });

  it("after 10 minutes in progress it gives up with 504", async () => {
    api([saved()]);
    const promise = createSearch({ code: "05001" }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 2000);
    expect(await promise).toMatchObject({ status: 504, message: expect.stringContaining("#9") });
  });

  it("if aborted it stops polling", async () => {
    const f = api([saved()]);
    const control = new AbortController();
    const promise = createSearch({ code: "05001" }, control.signal).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(2000);
    const calls = f.mock.calls.length;

    control.abort(new DOMException("cancelada", "AbortError"));
    expect(await promise).toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(f).toHaveBeenCalledTimes(calls);
  });
});
