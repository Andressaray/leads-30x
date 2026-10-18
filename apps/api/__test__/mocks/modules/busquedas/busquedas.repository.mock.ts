// Repositorio de búsquedas en memoria, con la misma firma que el real.

import type { BusquedasRepository } from 'modules/busquedas/domain/busquedas.domain';
import type { BusquedaDTO, BusquedaFuenteDTO, CreateBusquedaDTO, EstadoBusqueda, ResumenBusquedaDTO } from 'modules/busquedas/types/busquedas.types';

export interface RepositorioBusquedasEnMemoria extends BusquedasRepository {
  _estado: { busquedas: BusquedaDTO[] };
}

export function crearRepositorioBusquedasEnMemoria(): RepositorioBusquedasEnMemoria {
  const busquedas: BusquedaDTO[] = [];
  let siguienteId = 1;
  const porId = (id: number) => busquedas.find((b) => b.id === id);

  const repo = {
    _estado: { busquedas },
    async createBusqueda(dto: CreateBusquedaDTO) {
      const ahora = new Date();
      const b: BusquedaDTO = { ...dto, id: siguienteId++, estado: 'en_curso', resumen: null, terminadoEn: null, createdAt: ahora, updatedAt: ahora, fuentes: [] };
      busquedas.push(b);
      return structuredClone(b);
    },
    async upsertBusquedaFuente(busquedaId: number, f: BusquedaFuenteDTO) {
      const b = porId(busquedaId)!;
      b.fuentes = [...(b.fuentes ?? []).filter((x) => x.fuente !== f.fuente), f];
    },
    async updateBusqueda(id: number, datos: { estado: EstadoBusqueda; resumen: ResumenBusquedaDTO; terminadoEn: Date }) {
      const b = porId(id)!;
      Object.assign(b, datos, { updatedAt: new Date() });
      return structuredClone(b);
    },
    async cerrarBusquedasInconclusas() {
      const abiertas = busquedas.filter((b) => b.estado === 'en_curso');
      for (const b of abiertas) Object.assign(b, { estado: 'fallida', terminadoEn: new Date() });
      return abiertas.length;
    },
    async findBusquedas(limite: number) {
      return [...busquedas].reverse().slice(0, limite).map((b) => structuredClone(b));
    },
    async findBusquedaById(id: number) {
      const b = porId(id);
      return b ? structuredClone(b) : null;
    },
  };
  return repo as unknown as RepositorioBusquedasEnMemoria;
}
