import type { SessionUser } from '~types/auth.types';
import type { CostDTO, CreateCostDTO, UpdateCostDTO } from '../types/costs.types';

export interface CostsDomainInterface {
  /** Costs that overlap the period (or all of them). */
  list(filters: { from?: string; to?: string }): Promise<CostDTO[]>;
  /** 400 if the dates or amounts do not add up. For HOURS the amount = hours × hourly rate. */
  create(dto: CreateCostDTO, user: SessionUser): Promise<CostDTO>;
  /** 404 if it does not exist. */
  update(id: number, dto: UpdateCostDTO): Promise<CostDTO>;
  /** 404 if it does not exist. */
  remove(id: number): Promise<void>;
}
