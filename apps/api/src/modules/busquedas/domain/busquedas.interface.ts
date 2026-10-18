import type { BusquedaDTO, CrearBusquedaDTO, InicioBusquedaDTO, ResultadoBusquedaDTO } from '../types/busquedas.types';

export interface BusquedasDomainInterface {
  /** Busca leads en las fuentes para una ciudad, los deduplica y los guarda. */
  crear(dto: CrearBusquedaDTO): Promise<ResultadoBusquedaDTO>;
  /** Igual que crear, pero responde de inmediato y procesa en segundo plano. */
  iniciar(dto: CrearBusquedaDTO): Promise<InicioBusquedaDTO>;
  /** Historial de búsquedas, la más reciente primero. */
  listar(limite: number): Promise<BusquedaDTO[]>;
  /** Una búsqueda con el detalle por fuente. Lanza 404 si no existe. */
  obtener(id: number): Promise<BusquedaDTO>;
}
