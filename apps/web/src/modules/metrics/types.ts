export type MetricChannel = "email" | "whatsapp" | "call" | "dapta";
export type CostChannel = "dane" | "osm" | "rnt" | "secop" | "reps" | MetricChannel | "general";

export interface Indicators {
  replyRate: number | null;
  qualityIndex: number | null;
  highRate: number | null;
  costPerReply: number | null;
  costPerHighLead: number | null;
}

interface Funnel {
  contacted: number;
  replied: number;
  interested: number;
  qualified: number;
  high: number;
}

export interface SourceMetric extends Funnel, Indicators {
  source: string;
  leads: number;
  contactables: number;
  cost: { direct: number; general: number; contact: number; total: number };
  cpl: number | null;
}

export interface ChannelMetric extends Funnel, Indicators {
  channel: MetricChannel;
  outreach: number;
  contactedLeads: number;
  cost: number;
  costPerContact: number | null;
}

export interface Metrics {
  period: { from: string; to: string; days: number };
  totals: {
    leads: number;
    contacted: number;
    replied: number;
    qualified: number;
    high: number;
    totalCost: number;
    unassignedCost: number;
    cpl: number | null;
    costPerReply: number | null;
    costPerHighLead: number | null;
    qualityIndex: number | null;
  };
  bySource: SourceMetric[];
  byChannel: ChannelMetric[];
  costs: Partial<Record<CostChannel, number>>;
}

export interface Cost {
  id: number;
  channel: CostChannel;
  type: "EXPENSE" | "HOURS";
  description: string;
  amount: number;
  hours: number | null;
  hourlyRate: number | null;
  from: string;
  to: string;
  createdBy?: { id: number; fullName: string } | null;
}

export type NewCost = Omit<Cost, "id" | "createdBy" | "amount" | "hours" | "hourlyRate"> & {
  amount?: number;
  hours?: number;
  hourlyRate?: number;
};
