// Reglas de los costos: periodo válido y monto según el tipo (gasto directo u horas del equipo).
import * as repositorioReal from '../repository/costos.repository';
import { AppError, HttpCode } from '~response/index';
import type { UsuarioSesion } from '~types/auth.types';
import type { CostosDomainInterface } from './costos.interface';
import type { CostoDTO, CreateCostoDTO, DatosCostoDTO, UpdateCostoDTO } from '../types/costos.types';

export type CostosRepository = typeof repositorioReal;

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Valida y completa un costo: periodo en orden y monto (en HORAS = horas × valor de la hora). */
export function prepararCosto(c: CreateCostoDTO): Omit<DatosCostoDTO, 'creadoPorId'> {
  if (c.desde > c.hasta) throw new AppError(HttpCode.BAD_REQUEST, 'La fecha "desde" no puede ser posterior a "hasta".', { campo: 'desde' });
  if (c.tipo === 'HORAS') {
    if (!c.horas || c.horas <= 0) throw new AppError(HttpCode.BAD_REQUEST, 'Indica cuántas horas.', { campo: 'horas' });
    if (!c.valorHora || c.valorHora <= 0) throw new AppError(HttpCode.BAD_REQUEST, 'Indica el valor de la hora.', { campo: 'valorHora' });
    return {
      canal: c.canal, tipo: 'HORAS', descripcion: c.descripcion, horas: c.horas, valorHora: c.valorHora,
      monto: redondear(c.horas * c.valorHora), desde: c.desde, hasta: c.hasta,
    };
  }
  if (!c.monto || c.monto <= 0) throw new AppError(HttpCode.BAD_REQUEST, 'Indica el monto (mayor a 0).', { campo: 'monto' });
  return { canal: c.canal, tipo: 'GASTO', descripcion: c.descripcion, monto: redondear(c.monto), horas: null, valorHora: null, desde: c.desde, hasta: c.hasta };
}

export class CostosDomain implements CostosDomainInterface {
  constructor(private readonly repo: CostosRepository = repositorioReal) {}

  listar(filtros: { desde?: string; hasta?: string }): Promise<CostoDTO[]> {
    return this.repo.findCostos(filtros);
  }

  crear(dto: CreateCostoDTO, usuario: UsuarioSesion): Promise<CostoDTO> {
    return this.repo.createCosto({ ...prepararCosto(dto), creadoPorId: usuario.id });
  }

  async actualizar(id: number, dto: UpdateCostoDTO): Promise<CostoDTO> {
    const actual = await this.repo.findCosto(id);
    if (!actual) throw new AppError(HttpCode.NOT_FOUND, 'Costo no encontrado.');
    const combinado: CreateCostoDTO = {
      canal: dto.canal ?? actual.canal,
      tipo: dto.tipo ?? actual.tipo,
      descripcion: dto.descripcion ?? actual.descripcion,
      monto: dto.monto ?? actual.monto,
      horas: dto.horas ?? actual.horas ?? undefined,
      valorHora: dto.valorHora ?? actual.valorHora ?? undefined,
      desde: dto.desde ?? actual.desde,
      hasta: dto.hasta ?? actual.hasta,
    };
    return this.repo.updateCosto(id, prepararCosto(combinado));
  }

  async eliminar(id: number): Promise<void> {
    if (!(await this.repo.findCosto(id))) throw new AppError(HttpCode.NOT_FOUND, 'Costo no encontrado.');
    await this.repo.deleteCosto(id);
  }
}
