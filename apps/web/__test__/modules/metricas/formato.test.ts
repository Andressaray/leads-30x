import { afterEach, describe, expect, it, vi } from "vitest";
import { entero, fechaCorta, hoyColombia, pct, periodo, pesos } from "@/modules/metricas/formato";

// Intl usa espacios especiales (NBSP); se normalizan para comparar.
const texto = (s: string) => s.replace(/\s/g, " ");

describe("formato de métricas", () => {
  afterEach(() => vi.useRealTimers());

  it("pesos en COP sin decimales, o '—' si no hay valor", () => {
    expect(texto(pesos(1234567.8))).toMatch(/^\$ ?1\.234\.568$/);
    expect(pesos(null)).toBe("—");
    expect(pesos(undefined)).toBe("—");
  });

  it("porcentajes redondeados", () => {
    expect(pct(0.256)).toBe("26 %");
    expect(pct(0)).toBe("0 %");
    expect(pct(null)).toBe("—");
  });

  it("enteros con separador de miles", () => {
    expect(entero(12500)).toBe("12.500");
  });

  it("hoy es la fecha de Colombia, no la UTC", () => {
    vi.useFakeTimers({ now: new Date("2026-03-01T03:00:00Z") }); // 28 feb, 10 p. m. en Bogotá
    expect(hoyColombia()).toBe("2026-02-28");
  });

  describe("periodo", () => {
    it("este mes: del 1 a hoy", () => {
      vi.useFakeTimers({ now: new Date("2026-10-18T15:00:00Z") });
      expect(periodo("mes")).toEqual({ desde: "2026-10-01", hasta: "2026-10-18" });
    });

    it("mes pasado: completo, también al cruzar de año", () => {
      vi.useFakeTimers({ now: new Date("2026-03-10T15:00:00Z") });
      expect(periodo("mes-pasado")).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
      vi.setSystemTime(new Date("2026-01-15T15:00:00Z"));
      expect(periodo("mes-pasado")).toEqual({ desde: "2025-12-01", hasta: "2025-12-31" });
    });

    it("últimos 90 días contando hoy", () => {
      vi.useFakeTimers({ now: new Date("2026-10-18T15:00:00Z") });
      expect(periodo("90")).toEqual({ desde: "2026-07-21", hasta: "2026-10-18" });
    });
  });

  it("fecha corta en español sin correrse de día", () => {
    // El texto exacto ("1 ene 2026" o "1 de ene de 2026") depende de la versión de ICU de Node.
    const f = texto(fechaCorta("2026-01-01"));
    expect(f).toMatch(/^1 (de )?ene\.? (de )?2026$/);
    expect(texto(fechaCorta("2026-12-31"))).toMatch(/^31 (de )?dic/);
  });
});
