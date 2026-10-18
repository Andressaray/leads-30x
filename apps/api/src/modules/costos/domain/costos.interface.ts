import type { UsuarioSesion } from '~types/auth.types';
import type { CostoDTO, CreateCostoDTO, UpdateCostoDTO } from '../types/costos.types';

export interface CostosDomainInterface {
  /** Costos que se cruzan con el periodo (o todos). */
  listar(filtros: { desde?: string; hasta?: string }): Promise<CostoDTO[]>;
  /** 400 si las fechas o los montos no cuadran. En HORAS el monto = horas × valor hora. */
  crear(dto: CreateCostoDTO, usuario: UsuarioSesion): Promise<CostoDTO>;
  /** 404 si no existe. */
  actualizar(id: number, dto: UpdateCostoDTO): Promise<CostoDTO>;
  /** 404 si no existe. */
  eliminar(id: number): Promise<void>;
}
