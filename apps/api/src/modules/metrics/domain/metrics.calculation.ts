// Calculation of the CPL (point 3) and of the cost/quality comparison (point 4). Pure function: it receives the
// counts and the costs, and splits them. Rules:
//
//   1. Each cost is prorated by days: if it covers 30 days and the period takes 10, it counts 1/3.
//   2. Per SOURCE (where the lead was found), with the NEW leads of the period:
//        cost = direct cost of the source
//              + "general" split according to how many leads each source brought
//              + cost of each contact channel split according to how many of the source's leads were contacted through it
//        CPL = cost / leads
//   3. Per CONTACT CHANNEL (email, WhatsApp, call, Dapta): the direct cost of the channel.
//        cost per contact = cost / contacted leads; cost per reply = cost / replied.
//   4. Quality = Dapta qualification (or manual): 0–100 index and share of HIGH quality.

import { SOURCES } from '~types/source.types';
import { CONTACT_COST_CHANNELS, type CostChannel } from 'modules/costs/types/costs.types';
import type {
  MetricChannel,
  ContactsBySourceDTO,
  FunnelCountDTO,
  PeriodCostDTO,
  ChannelDataDTO,
  SourceDataDTO,
  IndicatorsDTO,
  ChannelMetricDTO,
  SourceMetricDTO,
  MetricsDTO,
  PeriodDTO,
} from '../types/metrics.types';

const DAY = 86_400_000;
const day = (s: string) => Date.parse(`${s}T00:00:00Z`) / DAY;
const weights = (n: number) => Math.round(n * 100) / 100;
const div = (a: number, b: number) => (b > 0 ? a / b : null);
const formatPesos = (a: number, b: number) => (b > 0 ? weights(a / b) : null);

/** Part of the cost that falls within the period (by days, both ends included). */
export function prorate(c: PeriodCostDTO, p: Pick<PeriodDTO, 'from' | 'to'>): number {
  const total = day(c.to) - day(c.from) + 1;
  const inside = Math.min(day(c.to), day(p.to)) - Math.max(day(c.from), day(p.from)) + 1;
  if (total <= 0 || inside <= 0) return 0;
  return (c.amount * inside) / total;
}

/** Splits an amount according to weights; if every weight is 0, it splits nothing. */
function distribute(amount: number, weightsByKey: Map<string, number>): Map<string, number> {
  const total = [...weightsByKey.values()].reduce((a, b) => a + b, 0);
  const r = new Map<string, number>();
  if (total <= 0) return r;
  for (const [k, w] of weightsByKey) r.set(k, (amount * w) / total);
  return r;
}

function indicators(e: FunnelCountDTO, cost: number): IndicatorsDTO {
  const index = div(e.indexSum, e.qualified);
  return {
    replyRate: div(e.replied, e.contacted),
    qualityIndex: index === null ? null : Math.round(index),
    highRate: div(e.high, e.qualified),
    costPerReply: formatPesos(cost, e.replied),
    costPerHighLead: formatPesos(cost, e.high),
  };
}

const EMPTY: FunnelCountDTO = { contacted: 0, replied: 0, interested: 0, qualified: 0, high: 0, indexSum: 0 };

export function calculateMetrics(input: {
  period: PeriodDTO;
  sources: SourceDataDTO[];
  channels: ChannelDataDTO[];
  contactsBySource: ContactsBySourceDTO[];
  costs: PeriodCostDTO[];
}): MetricsDTO {
  const { period } = input;

  // 1. Costs of the period per cost channel.
  const costs: Partial<Record<CostChannel, number>> = {};
  for (const c of input.costs) costs[c.channel] = (costs[c.channel] ?? 0) + prorate(c, period);
  const costOf = (k: CostChannel) => costs[k] ?? 0;

  // 2. Per source. The 5 sources are shown even if they brought no leads (to see their cost).
  const sourceData = new Map(input.sources.map((f) => [f.source, f]));
  const names = [...new Set([...SOURCES, ...sourceData.keys()])];
  const sourceRows = names.map((source): SourceDataDTO => sourceData.get(source) ?? { source, leads: 0, contactables: 0, ...EMPTY });

  const generalBySource = distribute(costOf('general'), new Map(sourceRows.map((f) => [f.source, f.leads])));
  const contactBySource = new Map<string, number>();
  let unassigned = sourceRows.some((f) => f.leads > 0) ? 0 : costOf('general');
  for (const channel of CONTACT_COST_CHANNELS) {
    const channelWeights = new Map(input.contactsBySource.filter((c) => c.channel === channel).map((c) => [c.source, c.leads]));
    const distribution = distribute(costOf(channel), channelWeights);
    if (!distribution.size) unassigned += costOf(channel);
    for (const [source, amount] of distribution) contactBySource.set(source, (contactBySource.get(source) ?? 0) + amount);
  }

  const bySource: SourceMetricDTO[] = sourceRows.map((f) => {
    const direct = costOf(f.source as CostChannel);
    const general = generalBySource.get(f.source) ?? 0;
    const contact = contactBySource.get(f.source) ?? 0;
    const total = direct + general + contact;
    return {
      ...f,
      cost: { direct: weights(direct), general: weights(general), contact: weights(contact), total: weights(total) },
      cpl: formatPesos(total, f.leads),
      ...indicators(f, total),
    };
  });

  // 3. Per contact channel.
  const channelData = new Map(input.channels.map((c) => [c.channel, c]));
  const byChannel: ChannelMetricDTO[] = CONTACT_COST_CHANNELS.map((channel: MetricChannel) => {
    const d = channelData.get(channel) ?? { channel, outreach: 0, ...EMPTY };
    const cost = costOf(channel);
    return { ...d, contactedLeads: d.contacted, cost: weights(cost), costPerContact: formatPesos(cost, d.contacted), ...indicators(d, cost) };
  });

  // 4. Totals (every cost of the period, whether it could be split or not).
  const totalCost = Object.values(costs).reduce((a, b) => a + (b ?? 0), 0);
  const sum = (k: keyof SourceDataDTO) => sourceRows.reduce((a, f) => a + (f[k] as number), 0);
  const leads = sum('leads');
  const replied = sum('replied');
  const high = sum('high');
  const qualified = sum('qualified');
  const index = div(sum('indexSum'), qualified);

  // Leads without a charged cost or contact end up with cost 0; sources with cost but no leads end up with a null CPL.
  return {
    period,
    totals: {
      leads,
      contacted: sum('contacted'),
      replied,
      qualified,
      high,
      totalCost: weights(totalCost),
      unassignedCost: weights(unassigned),
      cpl: formatPesos(totalCost, leads),
      costPerReply: formatPesos(totalCost, replied),
      costPerHighLead: formatPesos(totalCost, high),
      qualityIndex: index === null ? null : Math.round(index),
    },
    bySource,
    byChannel,
    costs: Object.fromEntries(Object.entries(costs).map(([k, v]) => [k, weights(v ?? 0)])),
  };
}
