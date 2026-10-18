import { CatalogDomain } from 'modules/catalog/domain/catalog.domain';

describe('CatalogoDomain', () => {
  const domain = new CatalogDomain();

  it('categories say which sources apply', async () => {
    const cats = await domain.categories();
    expect(cats.find((c) => c.key === 'hotel')?.sources).toEqual(['dane', 'osm', 'rnt', 'secop']);
    expect(cats.find((c) => c.key === 'health')?.sources).toEqual(['dane', 'osm', 'reps', 'secop']);
    expect(cats.find((c) => c.key === 'beauty')?.sources).toEqual(['dane', 'osm']);
  });

  it('departments sorted by name', async () => {
    const deps = await domain.departments();
    expect(deps.length).toBe(33);
    expect(deps.find((d) => d.code === '05')).toEqual({ code: '05', name: 'Antioquia' });
    expect(deps.every((d, i) => i === 0 || deps[i - 1].name.localeCompare(d.name, 'es') <= 0)).toBe(true);
  });

  it('municipalities by text and department', async () => {
    expect((await domain.municipalities({ q: 'granada', departmentCode: null, limit: 10 })).map((m) => m.code)).toEqual(['05313', '25312', '47460', '50313']);
    expect((await domain.municipalities({ q: 'granada', departmentCode: '50', limit: 10 })).map((m) => m.code)).toEqual(['50313']);
  });

  it('lists the 5 sources', async () => {
    expect((await domain.sources()).map((f) => f.name)).toEqual(['dane', 'osm', 'rnt', 'secop', 'reps']);
  });
});
