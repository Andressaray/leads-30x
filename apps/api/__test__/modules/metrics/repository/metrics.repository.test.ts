// Metrics queries against real PostgreSQL, with a hand-built scenario.
import * as repo from 'modules/metrics/repository/metrics.repository';
import * as costsRepo from 'modules/costs/repository/costs.repository';
import * as qualificationsRepo from 'modules/qualifications/repository/qualifications.repository';
import * as outreachRepo from 'modules/outreach/repository/outreach.repository';
import type { CreateInteractionDTO } from 'modules/outreach/types/outreach.types';
import { createTestUser, describeWithDb, resetDb, prisma } from '../../../setup/db';

const START = new Date('2026-10-01T05:00:00Z');
const END = new Date('2026-11-01T05:00:00Z');
const IN_OCT = new Date('2026-10-14T15:00:00Z');

async function lead(name: string, source: string, p: Record<string, unknown> = {}) {
  const l = await prisma.lead.create({
    data: { name, municipalityCode: '05615', municipality: 'RIONEGRO', department: 'Antioquia', originSource: source, contactable: true, createdAt: IN_OCT, ...p },
  });
  return l.id;
}

const outbound = (leadId: number, userId: number, channel: CreateInteractionDTO['channel'], status: CreateInteractionDTO['status'] = 'SENT'): CreateInteractionDTO => ({
  leadId, userId, channel, direction: 'OUTBOUND', status, destination: null, subject: null, message: null, note: null, result: null,
  error: null, providerId: null, templateId: null,
});

describeWithDb('metrics.repository', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('counts funnel, quality and contacts per source and per channel within the period', async () => {
    const u = await createTestUser();
    const a = await lead('A', 'osm', { quality: 'HIGH', score: 90 });
    const b = await lead('B', 'osm', { quality: 'LOW' }); // index 30 (no score)
    const c = await lead('C', 'rnt');
    await lead('Viejo', 'rnt', { createdAt: new Date('2026-09-20T15:00:00Z') }); // outside the period
    await lead('D', 'dane', { contactable: false });

    // a: email + another email + interested reply by email; b: WhatsApp + failed email; c: Dapta
    await outreachRepo.saveOutbound(outbound(a, u, 'EMAIL'), IN_OCT);
    await outreachRepo.saveOutbound(outbound(a, u, 'EMAIL'), IN_OCT);
    await outreachRepo.saveReply({ ...outbound(a, u, 'EMAIL', 'RECORDED'), direction: 'INBOUND', result: 'INTERESTED' }, 'INTERESTED', IN_OCT);
    await outreachRepo.saveOutbound(outbound(b, u, 'WHATSAPP', 'RECORDED'), IN_OCT);
    await outreachRepo.createInteraction(outbound(b, u, 'EMAIL', 'FAILED'));
    await qualificationsRepo.createQualification({
      leadId: c, userId: u, origin: 'DAPTA', status: 'SENT', reference: 'r1', quality: null, score: null, summary: null,
      variables: null, callId: null, error: null, qualifiedAt: null,
    });
    await qualificationsRepo.createQualification({
      leadId: b, userId: u, origin: 'DAPTA', status: 'FAILED', reference: 'r2', quality: null, score: null, summary: null,
      variables: null, callId: null, error: 'x', qualifiedAt: null,
    });
    // created_at of interactions and qualifications = now; the period must include today.
    const end = new Date(Date.now() + 86_400_000);

    const sources = await repo.findDataBySource(START, END);
    expect(sources.sort((x, y) => x.source.localeCompare(y.source))).toEqual([
      { source: 'dane', leads: 1, contactables: 0, contacted: 0, replied: 0, interested: 0, qualified: 0, high: 0, indexSum: 0 },
      { source: 'osm', leads: 2, contactables: 2, contacted: 2, replied: 1, interested: 1, qualified: 2, high: 1, indexSum: 120 },
      { source: 'rnt', leads: 1, contactables: 1, contacted: 0, replied: 0, interested: 0, qualified: 0, high: 0, indexSum: 0 },
    ]);

    const channels = await repo.findDataByChannel(START, end);
    expect(channels.sort((x, y) => x.channel.localeCompare(y.channel))).toEqual([
      { channel: 'dapta', outreach: 1, contacted: 1, replied: 0, interested: 0, qualified: 0, high: 0, indexSum: 0 },
      { channel: 'email', outreach: 2, contacted: 1, replied: 1, interested: 1, qualified: 1, high: 1, indexSum: 90 },
      { channel: 'whatsapp', outreach: 1, contacted: 1, replied: 0, interested: 0, qualified: 1, high: 0, indexSum: 30 },
    ]);

    const bySource = await repo.findContactsBySource(START, end);
    expect(bySource.sort((x, y) => (x.channel + x.source).localeCompare(y.channel + y.source))).toEqual([
      { channel: 'dapta', source: 'rnt', leads: 1 },
      { channel: 'email', source: 'osm', leads: 1 },
      { channel: 'whatsapp', source: 'osm', leads: 1 },
    ]);

    // Outside the range: nothing.
    expect(await repo.findDataByChannel(new Date('2025-01-01'), new Date('2025-02-01'))).toEqual([]);
  });

  it('costs: stores decimals and dates, and filters the ones that overlap the period', async () => {
    const u = await createTestUser();
    await costsRepo.createCost({ channel: 'general', type: 'EXPENSE', description: 'Servidor', amount: 93000.5, hours: null, hourlyRate: null, from: '2026-10-01', to: '2026-10-31', createdById: u });
    await costsRepo.createCost({ channel: 'rnt', type: 'HOURS', description: 'Revisión', amount: 62000, hours: 2, hourlyRate: 31000, from: '2026-09-25', to: '2026-10-02', createdById: u });
    await costsRepo.createCost({ channel: 'email', type: 'EXPENSE', description: 'Agosto', amount: 1, hours: null, hourlyRate: null, from: '2026-08-01', to: '2026-08-31' });
    const oct = await costsRepo.findCosts({ from: '2026-10-01', to: '2026-10-31' });
    expect(oct.map((c) => [c.channel, c.amount, c.hours, c.hourlyRate, c.from, c.to])).toEqual([
      ['general', 93000.5, null, null, '2026-10-01', '2026-10-31'],
      ['rnt', 62000, 2, 31000, '2026-09-25', '2026-10-02'],
    ]);
    expect(oct[0].createdBy).toEqual({ id: u, fullName: 'Andres Saray' });
    expect(await costsRepo.findCosts()).toHaveLength(3);
    const updated = await costsRepo.updateCost(oct[0].id, { to: '2026-11-30' });
    expect(updated.to).toBe('2026-11-30');
    await costsRepo.deleteCost(oct[0].id);
    expect(await costsRepo.findCost(oct[0].id)).toBeNull();
  });

  it('qualifications: the result is copied to the lead; the manual one too', async () => {
    const u = await createTestUser();
    const id = await lead('A', 'osm');
    const c = await qualificationsRepo.createQualification({
      leadId: id, userId: u, origin: 'DAPTA', status: 'SENT', reference: 'ref-a', quality: null, score: null, summary: null,
      variables: null, callId: null, error: null, qualifiedAt: null,
    });
    expect((await qualificationsRepo.findPendingDispatch(id))?.id).toBe(c.id);
    expect(await qualificationsRepo.findPendingDispatch(id, new Date(Date.now() + 60_000))).toBeNull();
    const t = new Date('2026-10-14T16:00:00Z');
    await qualificationsRepo.saveResult(c.id, { status: 'QUALIFIED', quality: 'MEDIUM', score: 60, summary: 'ok', variables: { demo: false }, callId: 'call-1', error: null, qualifiedAt: t });
    expect(await prisma.lead.findUnique({ where: { id }, select: { quality: true, score: true, qualifiedAt: true } })).toEqual({ quality: 'MEDIUM', score: 60, qualifiedAt: t });
    expect((await qualificationsRepo.findQualificationByReference('ref-a'))?.variables).toEqual({ demo: false });
    expect(await qualificationsRepo.findPendingDispatch(id)).toBeNull();

    await qualificationsRepo.createManualQualification({
      leadId: id, userId: u, origin: 'MANUAL', status: 'QUALIFIED', reference: 'ref-m', quality: 'HIGH', score: null, summary: 'Visita',
      variables: null, callId: null, error: null, qualifiedAt: t,
    });
    expect((await prisma.lead.findUnique({ where: { id } }))?.quality).toBe('HIGH');
    expect((await qualificationsRepo.findQualifications(id)).map((x) => x.origin)).toEqual(['MANUAL', 'DAPTA']);
    expect((await qualificationsRepo.findLeadForDapta(id))?.originSource).toBe('osm');
  });
});
