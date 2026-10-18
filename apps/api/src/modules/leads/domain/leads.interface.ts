import type { Candidato } from '~types/fuente.types';
import type {
  ConteoRegistroDTO,
  ContextoRegistroDTO,
  EstadisticaFuenteDTO,
  FiltrosLeadsDTO,
  LeadDetalleDTO,
  LeadDTO,
  ListadoLeadsDTO,
  ResumenBusquedaLeadsDTO,
} from '../types/leads.types';

export interface LeadsDomainInterface {
  /** Leads guardados, con filtros y paginación. */
  listar(filtros: FiltrosLeadsDTO): Promise<ListadoLeadsDTO>;
  /** Un lead con el historial de cada fuente que lo trajo. Lanza 404 si no existe. */
  obtener(id: number): Promise<LeadDetalleDTO>;
  /**
   * Marca un lead como contactado (primer acercamiento) y lo asigna al usuario.
   * Lanza 404 si no existe y 409 si ya lo contactó otra persona.
   */
  marcarContactado(id: number, usuarioId: number): Promise<LeadDTO>;
  /** CSV (con BOM para Excel) de los leads que cumplen los filtros. */
  exportarCsv(filtros: FiltrosLeadsDTO): Promise<string>;
  /** Deduplica y guarda los candidatos de una fuente dentro de una búsqueda. */
  registrarCandidatos(candidatos: Candidato[], ctx: ContextoRegistroDTO): Promise<ConteoRegistroDTO>;
  /** Totales de una búsqueda: leads, nuevos, contactables, en varias fuentes. */
  resumenDeBusqueda(busquedaId: number): Promise<ResumenBusquedaLeadsDTO>;
  /** Leads, contactables y atribuidos por fuente (insumo del CPL por canal). */
  estadisticas(): Promise<EstadisticaFuenteDTO[]>;
}
