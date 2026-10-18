import { SOURCES } from '~types/source.types';

/** Contact channels that generate costs (email, WhatsApp, calls and Dapta). */
export const CONTACT_COST_CHANNELS = ['email', 'whatsapp', 'call', 'dapta'] as const;
/** What a cost is charged to: a source (where the lead was found), a contact channel, or "general". */
export const COST_CHANNELS = [...SOURCES, ...CONTACT_COST_CHANNELS, 'general'] as const;
export type CostChannel = (typeof COST_CHANNELS)[number];
export type CostType = 'EXPENSE' | 'HOURS';

export interface CostDTO {
  id: number;
  channel: CostChannel;
  type: CostType;
  description: string;
  /** Colombian pesos. */
  amount: number;
  hours: number | null;
  hourlyRate: number | null;
  /** AAAA-MM-DD, inclusive. */
  from: string;
  to: string;
  createdById: number | null;
  createdBy?: { id: number; fullName: string } | null;
  createdAt: Date;
}

export interface CreateCostDTO {
  channel: CostChannel;
  type: CostType;
  description: string;
  amount?: number;
  hours?: number;
  hourlyRate?: number;
  from: string;
  to: string;
}

export type UpdateCostDTO = Partial<CreateCostDTO>;

/** What is stored (with the amount already calculated). */
export interface CostDataDTO {
  channel: CostChannel;
  type: CostType;
  description: string;
  amount: number;
  hours: number | null;
  hourlyRate: number | null;
  from: string;
  to: string;
  createdById?: number | null;
}
