import { afterEach, describe, expect, it, vi } from "vitest";
import { integer, shortDate, todayColombia, pct, period, weights } from "@/modules/metrics/format";

// Intl uses special spaces (NBSP); they are normalized to compare.
const text = (s: string) => s.replace(/\s/g, " ");

describe("metrics formatting", () => {
  afterEach(() => vi.useRealTimers());

  it("pesos in COP without decimals, or '—' when there is no value", () => {
    expect(text(weights(1234567.8))).toMatch(/^\$ ?1\.234\.568$/);
    expect(weights(null)).toBe("—");
    expect(weights(undefined)).toBe("—");
  });

  it("rounded percentages", () => {
    expect(pct(0.256)).toBe("26 %");
    expect(pct(0)).toBe("0 %");
    expect(pct(null)).toBe("—");
  });

  it("integers with a thousands separator", () => {
    expect(integer(12500)).toBe("12.500");
  });

  it("today is Colombia's date, not UTC's", () => {
    vi.useFakeTimers({ now: new Date("2026-03-01T03:00:00Z") }); // Feb 28, 10 p.m. in Bogotá
    expect(todayColombia()).toBe("2026-02-28");
  });

  describe("period", () => {
    it("this month: from the 1st to today", () => {
      vi.useFakeTimers({ now: new Date("2026-10-18T15:00:00Z") });
      expect(period("month")).toEqual({ from: "2026-10-01", to: "2026-10-18" });
    });

    it("last month: complete, also when crossing the year", () => {
      vi.useFakeTimers({ now: new Date("2026-03-10T15:00:00Z") });
      expect(period("last-month")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
      vi.setSystemTime(new Date("2026-01-15T15:00:00Z"));
      expect(period("last-month")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    });

    it("last 90 days counting today", () => {
      vi.useFakeTimers({ now: new Date("2026-10-18T15:00:00Z") });
      expect(period("90")).toEqual({ from: "2026-07-21", to: "2026-10-18" });
    });
  });

  it("short date in Spanish without shifting the day", () => {
    // The exact text ("1 ene 2026" or "1 de ene de 2026") depends on Node's ICU version.
    const f = text(shortDate("2026-01-01"));
    expect(f).toMatch(/^1 (de )?ene\.? (de )?2026$/);
    expect(text(shortDate("2026-12-31"))).toMatch(/^31 (de )?dic/);
  });
});
