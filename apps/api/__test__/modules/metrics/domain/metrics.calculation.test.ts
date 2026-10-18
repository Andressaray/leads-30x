// CPL per source and per channel: prorating and splitting costs, with numbers that can be checked by hand.
import { calculateMetrics, prorate } from 'modules/metrics/domain/metrics.calculation';
import type { ContactsBySourceDTO, PeriodCostDTO, ChannelDataDTO, SourceDataDTO } from 'modules/metrics/types/metrics.types';

const OCT = { from: '2026-10-01', to: '2026-10-31', days: 31 };
const empty = { contacted: 0, replied: 0, interested: 0, qualified: 0, high: 0, indexSum: 0 };
const source = (f: string, p: Partial<SourceDataDTO>): SourceDataDTO => ({ source: f, leads: 0, contactables: 0, ...empty, ...p });
const channel = (c: ChannelDataDTO['channel'], p: Partial<ChannelDataDTO>): ChannelDataDTO => ({ channel: c, outreach: 0, ...empty, ...p });
const cost = (channel: PeriodCostDTO['channel'], amount: number, from = '2026-10-01', to = '2026-10-31'): PeriodCostDTO => ({ channel, amount, from, to });

describe('prorate', () => {
  it('counts only the days that fall in the period (both ends included)', () => {
    expect(prorate(cost('general', 3100), OCT)).toBe(3100);
    expect(prorate(cost('general', 3100), { from: '2026-10-01', to: '2026-10-10' })).toBeCloseTo(1000);
    expect(prorate(cost('general', 3000, '2026-09-16', '2026-10-15'), OCT)).toBeCloseTo(1500); // 15 of 30 days
    expect(prorate(cost('general', 500, '2026-11-01', '2026-11-30'), OCT)).toBe(0);
    expect(prorate(cost('general', 70, '2026-10-31', '2026-10-31'), OCT)).toBe(70);
  });
});

describe('calculateMetrics', () => {
  const base = {
    period: OCT,
    sources: [
      source('osm', { leads: 30, contactables: 20, contacted: 10, replied: 4, interested: 1, qualified: 4, high: 1, indexSum: 200 }),
      source('rnt', { leads: 10, contactables: 10, contacted: 10, replied: 5, interested: 3, qualified: 5, high: 3, indexSum: 375 }),
    ],
    channels: [
      channel('email', { outreach: 25, contacted: 20, replied: 9, interested: 4, qualified: 9, high: 4, indexSum: 575 }),
      channel('dapta', { outreach: 5, contacted: 5, replied: 3, qualified: 3, high: 1, indexSum: 160 }),
    ],
    contactsBySource: [
      { channel: 'email', source: 'osm', leads: 10 },
      { channel: 'email', source: 'rnt', leads: 10 },
      { channel: 'dapta', source: 'rnt', leads: 5 },
    ] as ContactsBySourceDTO[],
    costs: [cost('general', 40000), cost('email', 20000), cost('dapta', 50000), cost('rnt', 7000)],
  };

  it('per source: direct + general by leads + contact by leads contacted through each channel', () => {
    const m = calculateMetrics(base);
    const osm = m.bySource.find((f) => f.source === 'osm')!;
    const rnt = m.bySource.find((f) => f.source === 'rnt')!;
    // general 40,000 → 30:10 ; email 20,000 → 10:10 ; dapta 50,000 → all to rnt
    expect(osm.cost).toEqual({ direct: 0, general: 30000, contact: 10000, total: 40000 });
    expect(rnt.cost).toEqual({ direct: 7000, general: 10000, contact: 60000, total: 77000 });
    expect(osm.cpl).toBe(1333.33);
    expect(rnt.cpl).toBe(7700);
    expect(rnt).toMatchObject({ replyRate: 0.5, qualityIndex: 75, highRate: 0.6, costPerReply: 15400, costPerHighLead: 25666.67 });
  });

  it('always shows the 5 sources and the 4 channels, even when they are zero', () => {
    const m = calculateMetrics(base);
    expect(m.bySource.map((f) => f.source)).toEqual(['dane', 'osm', 'rnt', 'secop', 'reps']);
    expect(m.bySource.find((f) => f.source === 'dane')).toMatchObject({ leads: 0, cpl: null, qualityIndex: null, replyRate: null });
    expect(m.byChannel.map((c) => c.channel)).toEqual(['email', 'whatsapp', 'call', 'dapta']);
  });

  it('per channel: direct cost of the channel over contacted leads, replies and high-quality leads', () => {
    const m = calculateMetrics(base);
    const email = m.byChannel.find((c) => c.channel === 'email')!;
    const dapta = m.byChannel.find((c) => c.channel === 'dapta')!;
    expect(email).toMatchObject({ cost: 20000, contactedLeads: 20, costPerContact: 1000, costPerReply: 2222.22, replyRate: 0.45, qualityIndex: 64 });
    expect(dapta).toMatchObject({ cost: 50000, costPerContact: 10000, costPerHighLead: 50000, qualityIndex: 53 });
  });

  it('totals: add up every cost of the period', () => {
    const m = calculateMetrics(base);
    expect(m.totals).toMatchObject({ leads: 40, totalCost: 117000, unassignedCost: 0, cpl: 2925, replied: 9, high: 4, qualityIndex: 64 });
    expect(m.bySource.reduce((a, f) => a + f.cost.total, 0)).toBeCloseTo(117000);
  });

  it('a channel with cost but no contacts, or general costs without leads, remain "unassigned"', () => {
    const m = calculateMetrics({ ...base, costs: [...base.costs, cost('whatsapp', 9000)] });
    expect(m.totals.unassignedCost).toBe(9000);
    expect(m.byChannel.find((c) => c.channel === 'whatsapp')).toMatchObject({ cost: 9000, costPerContact: null });

    const noLeads = calculateMetrics({ ...base, sources: [], contactsBySource: [], costs: [cost('general', 1000), cost('email', 500)] });
    expect(noLeads.totals).toMatchObject({ leads: 0, totalCost: 1500, unassignedCost: 1500, cpl: null });
  });

  it('without costs: everything is 0 and the CPLs are 0 (not null) when there are leads', () => {
    const m = calculateMetrics({ ...base, costs: [] });
    expect(m.totals.totalCost).toBe(0);
    expect(m.bySource.find((f) => f.source === 'osm')?.cpl).toBe(0);
  });
});
