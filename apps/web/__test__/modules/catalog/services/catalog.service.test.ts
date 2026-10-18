import { beforeEach, describe, expect, it, vi } from "vitest";
import { failure, call, mockFetch, ok } from "../../../helpers/http";

// The cache lives in the module: each test imports it again to start with nothing stored.
async function service() {
  vi.resetModules();
  return import("@/modules/catalog");
}

describe("catalog.service", () => {
  beforeEach(() => vi.resetModules());

  it("sorts the municipalities alphabetically in Spanish", async () => {
    const f = mockFetch({
      "/api/catalog/municipalities": ok([
        { code: "3", name: "Zipaquirá" },
        { code: "1", name: "Ábrego" },
        { code: "2", name: "Bogotá" },
      ]),
    });
    const { getMunicipalities } = await service();
    const list = await getMunicipalities("25");
    expect(list.map((m) => m.name)).toEqual(["Ábrego", "Bogotá", "Zipaquirá"]);
    expect(call(f).url.search).toBe("?department=25&limit=1200");
  });

  it("caches each catalog in memory and does not request it again", async () => {
    const f = mockFetch({
      "/api/catalog/categories": ok([{ key: "a", name: "A" }]),
      "/api/catalog/departments": ok([{ code: "05", name: "Antioquia" }]),
      "/api/catalog/municipalities": ok([]),
    });
    const { getCategories, getDepartments, getMunicipalities } = await service();
    await getCategories();
    await getCategories();
    await getDepartments();
    await getDepartments();
    await getMunicipalities("05");
    await getMunicipalities("05");
    await getMunicipalities("08");
    expect(f).toHaveBeenCalledTimes(4);
  });

  it("does not cache errors: it retries the next time", async () => {
    let attempts = 0;
    mockFetch({ "/api/catalog/categories": () => (++attempts === 1 ? failure(500, "caída") : ok([{ key: "a", name: "A" }])) });
    const { getCategories } = await service();
    await expect(getCategories()).rejects.toThrow("caída");
    await expect(getCategories()).resolves.toHaveLength(1);
    expect(attempts).toBe(2);
  });
});
