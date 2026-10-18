import { beforeEach, describe, expect, it, vi } from "vitest";
import { falla, llamada, mockFetch, ok } from "../../../helpers/http";

// La caché vive en el módulo: cada prueba lo importa de nuevo para empezar sin nada guardado.
async function servicio() {
  vi.resetModules();
  return import("@/modules/catalogo");
}

describe("catalogo.service", () => {
  beforeEach(() => vi.resetModules());

  it("ordena los municipios alfabéticamente en español", async () => {
    const f = mockFetch({
      "/api/catalogo/municipios": ok([
        { codigo: "3", nombre: "Zipaquirá" },
        { codigo: "1", nombre: "Ábrego" },
        { codigo: "2", nombre: "Bogotá" },
      ]),
    });
    const { getMunicipios } = await servicio();
    const lista = await getMunicipios("25");
    expect(lista.map((m) => m.nombre)).toEqual(["Ábrego", "Bogotá", "Zipaquirá"]);
    expect(llamada(f).url.search).toBe("?departamento=25&limite=1200");
  });

  it("guarda en memoria cada catálogo y no vuelve a pedirlo", async () => {
    const f = mockFetch({
      "/api/catalogo/categorias": ok([{ clave: "a", nombre: "A" }]),
      "/api/catalogo/departamentos": ok([{ codigo: "05", nombre: "Antioquia" }]),
      "/api/catalogo/municipios": ok([]),
    });
    const { getCategorias, getDepartamentos, getMunicipios } = await servicio();
    await getCategorias();
    await getCategorias();
    await getDepartamentos();
    await getDepartamentos();
    await getMunicipios("05");
    await getMunicipios("05");
    await getMunicipios("08");
    expect(f).toHaveBeenCalledTimes(4);
  });

  it("no guarda los errores: la siguiente vez reintenta", async () => {
    let intentos = 0;
    mockFetch({ "/api/catalogo/categorias": () => (++intentos === 1 ? falla(500, "caída") : ok([{ clave: "a", nombre: "A" }])) });
    const { getCategorias } = await servicio();
    await expect(getCategorias()).rejects.toThrow("caída");
    await expect(getCategorias()).resolves.toHaveLength(1);
    expect(intentos).toBe(2);
  });
});
