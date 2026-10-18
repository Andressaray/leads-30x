import type { UsuarioSesion } from '~types/auth.types';
import type {
  CalificacionDTO,
  CalificarManualDTO,
  EstadoDaptaDTO,
  ResultadoEnvioLoteDTO,
} from '../types/calificaciones.types';

export interface CalificacionesDomainInterface {
  /** Cómo está configurada la integración (para la web). */
  estado(): EstadoDaptaDTO;
  /** Historial de calificaciones de un lead (404 si no existe). */
  listar(leadId: number): Promise<CalificacionDTO[]>;
  /**
   * Manda un lead a Dapta. 409 si pidió no ser contactado, si lo trabaja otra persona o si ya
   * está en Dapta esperando resultado; 422 si no tiene teléfono o la Ley 2300 no permite llamarlo
   * ahora (cuando Dapta llama); 502 si Dapta no lo recibe; 503 si la integración está desactivada.
   */
  enviar(leadId: number, usuario: UsuarioSesion): Promise<CalificacionDTO>;
  /** Manda varios leads; los que no se pueden se omiten con su motivo. */
  enviarLote(leadIds: number[], usuario: UsuarioSesion): Promise<ResultadoEnvioLoteDTO>;
  /** Resultado que manda el flujo de Dapta. 401 con secreto inválido; 404 si no se encuentra el envío. */
  recibirResultado(body: Record<string, unknown>, secreto: string | undefined): Promise<CalificacionDTO>;
  /** Calificación a mano (quien trabaja el lead o un ADMIN). */
  calificarManual(leadId: number, dto: CalificarManualDTO, usuario: UsuarioSesion): Promise<CalificacionDTO>;
}
