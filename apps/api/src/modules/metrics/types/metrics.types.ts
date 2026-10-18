import type { CostChannel } from 'modules/costs/types/costs.types';

export type MetricChannel = 'email' | 'whatsapp' | 'call' | 'dapta';

export interface PeriodDTO {
  /** YYYY-MM-DD, inclusive (Colombian calendar). */
  from: string;
  to: string;
  days: number;
}

/** Raw counts coming from the database. "indexSum" = sum of the quality index of the qualified leads. */
export interface FunnelCountDTO {
  contacted: number;
  replied: number;
  interested: number;
  qualified: number;
  high: number;
  indexSum: number;
}

export interface SourceDataDTO extends FunnelCountDTO {
  source: string;
  leads: number;
  contactables: number;
}

export interface ChannelDataDTO extends FunnelCountDTO {
  channel: MetricChannel;
  /** Messages, calls or dispatches to Dapta that went out. */
  outreach: number;
}

/** Distinct leads contacted per channel, by the source that brought them (to split the channel cost). */
export interface ContactsBySourceDTO {
  channel: MetricChannel;
  source: string;
  leads: number;
}

export interface PeriodCostDTO {
  channel: CostChannel;
  amount: number;
  from: string;
  to: string;
}

export interface CostBreakdownDTO {
  /** Charged directly to the source. */
  direct: number;
  /** Share of the "general" costs, according to how many leads the source brought. */
  general: number;
  /** Share of the contact cost (email, WhatsApp, calls, Dapta), according to how many of its leads were contacted through each channel. */
  contact: number;
  total: number;
}

export interface IndicatorsDTO {
  /** replied / contacted (0–1). */
  replyRate: number | null;
  /** 0–100 average of the qualified leads (score, or HIGH 85 · MEDIUM 60 · LOW 30 · DISCARDED 0). */
  qualityIndex: number | null;
  /** high / qualified (0–1). */
  highRate: number | null;
  costPerReply: number | null;
  costPerHighLead: number | null;
}

export interface SourceMetricDTO extends SourceDataDTO, IndicatorsDTO {
  cost: CostBreakdownDTO;
  /** Cost per lead: total cost / leads. */
  cpl: number | null;
}

export interface ChannelMetricDTO extends ChannelDataDTO, IndicatorsDTO {
  /** Distinct leads contacted by the channel. */
  contactedLeads: number;
  cost: number;
  /** Cost per contacted lead. */
  costPerContact: number | null;
}

export interface MetricsDTO {
  period: PeriodDTO;
  totals: {
    leads: number;
    contacted: number;
    replied: number;
    qualified: number;
    high: number;
    totalCost: number;
    /** Costs that could not be split (e.g. a channel without contacts in the period). */
    unassignedCost: number;
    cpl: number | null;
    costPerReply: number | null;
    costPerHighLead: number | null;
    qualityIndex: number | null;
  };
  bySource: SourceMetricDTO[];
  byChannel: ChannelMetricDTO[];
  /** Cost of the period per cost channel (already prorated). */
  costs: Partial<Record<CostChannel, number>>;
}
