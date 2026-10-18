import * as repo from 'modules/busquedas/repository/busquedas.repository';
import { describeConBase, limpiarBase, prisma } from '../../../setup/db';
import type { FiltrosBusqueda } from '~types/fuente.types';

const filtros = { categoria: 'hotel', nombre: 'Hoteles', todos: false, incluirPersonasNaturales: false, porFuente: {} } as unknown as FiltrosBusqueda;

describeConBase('busquedas.repository', () => {
  beforeEach(limpiarBase);
  afterAll(() => prisma.$disconnect());

  it('crea, registra fuentes, termina y consulta', async () => {
    const b = await repo.createBusqueda({
      ciudadTexto: 'Rionegro', departamentoTexto: 'Antioquia', codMpio: '05615', municipio: 'RIONEGRO',
      departamento: 'Antioquia', categoria: 'hotel', filtros, fuentesPedidas: ['dane', 'osm'],
    });
    expect(b).toMatchObject({ estado: 'en_curso', fuentesPedidas: ['dane', 'osm'] });

    const fuente = { fuente: 'dane' as const, estado: 'ok' as const, registros: 3, nuevos: 3, enriquecidos: 0, sinCambios: 0, omitidos: 0, duracionMs: 10, error: null, meta: { consultas: 1 } };
    await repo.upsertBusquedaFuente(b.id, fuente);
    await repo.upsertBusquedaFuente(b.id, { ...fuente, nuevos: 2 });
    const resumen = { leads: 3, nuevos: 3, contactables: 0, enVariasFuentes: 0, porFuente: { dane: fuente } };
    await repo.updateBusqueda(b.id, { estado: 'completa', resumen, terminadoEn: new Date() });

    const detalle = await repo.findBusquedaById(b.id);
    expect(detalle).toMatchObject({ estado: 'completa', resumen: { leads: 3 }, filtros: { categoria: 'hotel' } });
    expect(detalle?.fuentes).toEqual([expect.objectContaining({ fuente: 'dane', nuevos: 2, meta: { consultas: 1 } })]);
    expect(await repo.findBusquedas(10)).toHaveLength(1);
    expect(await repo.findBusquedaById(999)).toBeNull();
  });
});
