import { CatalogoDomain } from 'modules/catalogo/domain/catalogo.domain';

describe('CatalogoDomain', () => {
  const dominio = new CatalogoDomain();

  it('categorías indican qué fuentes aplican', async () => {
    const cats = await dominio.categorias();
    expect(cats.find((c) => c.clave === 'hotel')?.fuentes).toEqual(['dane', 'osm', 'rnt', 'secop']);
    expect(cats.find((c) => c.clave === 'salud')?.fuentes).toEqual(['dane', 'osm', 'reps', 'secop']);
    expect(cats.find((c) => c.clave === 'belleza')?.fuentes).toEqual(['dane', 'osm']);
  });

  it('departamentos ordenados por nombre', async () => {
    const deps = await dominio.departamentos();
    expect(deps.length).toBe(33);
    expect(deps.find((d) => d.codigo === '05')).toEqual({ codigo: '05', nombre: 'Antioquia' });
    expect(deps.every((d, i) => i === 0 || deps[i - 1].nombre.localeCompare(d.nombre, 'es') <= 0)).toBe(true);
  });

  it('municipios por texto y departamento', async () => {
    expect((await dominio.municipios({ q: 'granada', codDpto: null, limite: 10 })).map((m) => m.codigo)).toEqual(['05313', '25312', '47460', '50313']);
    expect((await dominio.municipios({ q: 'granada', codDpto: '50', limite: 10 })).map((m) => m.codigo)).toEqual(['50313']);
  });

  it('lista las 5 fuentes', async () => {
    expect((await dominio.fuentes()).map((f) => f.nombre)).toEqual(['dane', 'osm', 'rnt', 'secop', 'reps']);
  });
});
