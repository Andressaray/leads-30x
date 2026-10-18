// Cost rules: valid period and amount according to the type (direct expense or team hours).
import * as realRepository from '../repository/costs.repository';
import { AppError, HttpCode } from '~response/index';
import type { SessionUser } from '~types/auth.types';
import type { CostsDomainInterface } from './costs.interface';
import type { CostDTO, CreateCostDTO, CostDataDTO, UpdateCostDTO } from '../types/costs.types';

export type CostsRepository = typeof realRepository;

const round = (n: number) => Math.round(n * 100) / 100;

/** Validates and completes a cost: ordered period and amount (for HOURS = hours × hourly rate). */
export function prepareCost(c: CreateCostDTO): Omit<CostDataDTO, 'createdById'> {
  if (c.from > c.to) throw new AppError(HttpCode.BAD_REQUEST, 'La fecha "from" no puede ser posterior a "to".', { field: 'from' });
  if (c.type === 'HOURS') {
    if (!c.hours || c.hours <= 0) throw new AppError(HttpCode.BAD_REQUEST, 'Indica cuántas horas.', { field: 'hours' });
    if (!c.hourlyRate || c.hourlyRate <= 0) throw new AppError(HttpCode.BAD_REQUEST, 'Indica el valor de la hora.', { field: 'hourlyRate' });
    return {
      channel: c.channel, type: 'HOURS', description: c.description, hours: c.hours, hourlyRate: c.hourlyRate,
      amount: round(c.hours * c.hourlyRate), from: c.from, to: c.to,
    };
  }
  if (!c.amount || c.amount <= 0) throw new AppError(HttpCode.BAD_REQUEST, 'Indica el monto (mayor a 0).', { field: 'amount' });
  return { channel: c.channel, type: 'EXPENSE', description: c.description, amount: round(c.amount), hours: null, hourlyRate: null, from: c.from, to: c.to };
}

export class CostsDomain implements CostsDomainInterface {
  constructor(private readonly repo: CostsRepository = realRepository) {}

  list(filters: { from?: string; to?: string }): Promise<CostDTO[]> {
    return this.repo.findCosts(filters);
  }

  create(dto: CreateCostDTO, user: SessionUser): Promise<CostDTO> {
    return this.repo.createCost({ ...prepareCost(dto), createdById: user.id });
  }

  async update(id: number, dto: UpdateCostDTO): Promise<CostDTO> {
    const current = await this.repo.findCost(id);
    if (!current) throw new AppError(HttpCode.NOT_FOUND, 'Costo no encontrado.');
    const combined: CreateCostDTO = {
      channel: dto.channel ?? current.channel,
      type: dto.type ?? current.type,
      description: dto.description ?? current.description,
      amount: dto.amount ?? current.amount,
      hours: dto.hours ?? current.hours ?? undefined,
      hourlyRate: dto.hourlyRate ?? current.hourlyRate ?? undefined,
      from: dto.from ?? current.from,
      to: dto.to ?? current.to,
    };
    return this.repo.updateCost(id, prepareCost(combined));
  }

  async remove(id: number): Promise<void> {
    if (!(await this.repo.findCost(id))) throw new AppError(HttpCode.NOT_FOUND, 'Costo no encontrado.');
    await this.repo.deleteCost(id);
  }
}
