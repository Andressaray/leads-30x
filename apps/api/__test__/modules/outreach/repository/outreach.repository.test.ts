// Against the real test database (DATABASE_URL_TEST): transactions and lead status changes.
import * as repo from 'modules/outreach/repository/outreach.repository';
import * as leadsRepo from 'modules/leads/repository/leads.repository';
import * as templatesRepo from 'modules/templates/repository/templates.repository';
import type { CreateInteractionDTO } from 'modules/outreach/types/outreach.types';
import { createTestUser, describeWithDb, resetDb, prisma } from '../../../setup/db';

async function createLead(): Promise<number> {
  const l = await prisma.lead.create({
    data: {
      name: 'Café Prueba', municipalityCode: '05615', municipality: 'RIONEGRO', department: 'Antioquia', originSource: 'osm',
      emails: ['hola@cafe.test'], phones: [{ number: '+573001112233', type: 'mobile', whatsapp: true }],
    },
  });
  return l.id;
}

const outbound = (leadId: number, userId: number | null, p: Partial<CreateInteractionDTO> = {}): CreateInteractionDTO => ({
  leadId, userId, channel: 'EMAIL', direction: 'OUTBOUND', status: 'SENT', destination: 'hola@cafe.test', subject: 'Hola',
  message: 'Mensaje', note: null, result: null, error: null, providerId: '<x@y>', templateId: null, ...p,
});

describeWithDb('outreach.repository', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('saveOutbound: assigns, moves to CONTACTED and does not take the lead away from whoever had it', async () => {
    const andres = await createTestUser();
    const camila = await createTestUser({ email: 'camila@gmail.com', fullName: 'Camila Rojas' });
    const id = await createLead();
    const t1 = new Date('2026-10-14T15:00:00Z');
    const i = await repo.saveOutbound(outbound(id, andres), t1);
    expect(i).toMatchObject({ channel: 'EMAIL', status: 'SENT', user: { id: andres, fullName: 'Andres Saray' } });
    expect(await repo.findLeadContact(id)).toMatchObject({
      contacted: true, contactedById: andres, contactStatus: 'CONTACTED', lastContactedAt: t1,
      contactedBy: { fullName: 'Andres Saray' },
    });
    const t2 = new Date('2026-10-15T15:00:00Z');
    await repo.saveOutbound(outbound(id, camila, { channel: 'CALL', status: 'RECORDED' }), t2);
    expect(await repo.findLeadContact(id)).toMatchObject({ contactedById: andres, lastContactedAt: t2 });
  });

  it('saveReply: status = result and repliedAt only the first time (a bounce does not count)', async () => {
    const u = await createTestUser();
    const id = await createLead();
    await repo.saveOutbound(outbound(id, u), new Date('2026-10-14T15:00:00Z'));
    const inbound = (result: 'BOUNCED' | 'REPLIED' | 'INTERESTED') =>
      outbound(id, u, { direction: 'INBOUND', status: 'RECORDED', result, destination: null, providerId: null });
    await repo.saveReply(inbound('BOUNCED'), 'BOUNCED', new Date('2026-10-14T16:00:00Z'));
    expect(await repo.findLeadContact(id)).toMatchObject({ contactStatus: 'BOUNCED', repliedAt: null });
    await repo.saveReply(inbound('REPLIED'), 'REPLIED', new Date('2026-10-14T17:00:00Z'));
    await repo.saveReply(inbound('INTERESTED'), 'INTERESTED', new Date('2026-10-14T18:00:00Z'));
    expect(await repo.findLeadContact(id)).toMatchObject({ contactStatus: 'INTERESTED', repliedAt: new Date('2026-10-14T17:00:00Z') });
    expect((await repo.findInteractions(id)).map((i) => i.result)).toEqual(['INTERESTED', 'REPLIED', 'BOUNCED', null]);
  });

  it('findOutboundSince ignores failed, inbound and earlier ones', async () => {
    const u = await createTestUser();
    const id = await createLead();
    await repo.createInteraction(outbound(id, u, { status: 'FAILED', error: '550' }));
    await repo.saveOutbound(outbound(id, u, { channel: 'WHATSAPP', status: 'RECORDED' }), new Date());
    await repo.saveReply(outbound(id, u, { direction: 'INBOUND', status: 'RECORDED', result: 'REPLIED' }), 'REPLIED', new Date());
    const previousOutbound = await repo.findOutboundSince(id, new Date(Date.now() - 60_000));
    expect(previousOutbound.map((s) => s.channel)).toEqual(['WHATSAPP']);
    expect(await repo.findOutboundSince(id, new Date(Date.now() + 60_000))).toEqual([]);
  });

  it('markDoNotContact is idempotent and works without a user (unsubscribe link)', async () => {
    const id = await createLead();
    const dto = outbound(id, null, { direction: 'INBOUND', status: 'RECORDED', channel: 'EMAIL', note: 'Baja' });
    expect(await repo.markDoNotContact(dto, new Date())).toBe(true);
    expect(await repo.markDoNotContact(dto, new Date())).toBe(false);
    expect((await repo.findLeadContact(id))?.doNotContact).toBe(true);
    expect(await repo.findInteractions(id)).toHaveLength(1);
  });

  it('the "Contact" button (without a message) also leaves the lead CONTACTED; the status filter works', async () => {
    const u = await createTestUser();
    const id = await createLead();
    await createLead();
    expect(await leadsRepo.assignContact(id, u)).toBe(true);
    const filters = { limit: 10, page: 1 };
    expect((await leadsRepo.findLeads({ ...filters, statuses: ['CONTACTED'] })).map((l) => l.id)).toEqual([id]);
    expect(await leadsRepo.countLeads({ statuses: ['PENDING', 'CONTACTED'] })).toBe(2);
  });

  it('a search that enriches the lead does not overwrite its contact status', async () => {
    const u = await createTestUser();
    const id = await createLead();
    await repo.saveReply(outbound(id, u, { direction: 'INBOUND', result: 'INTERESTED' }), 'INTERESTED', new Date());
    await leadsRepo.updateLead(id, { contactStatus: 'PENDING', doNotContact: false, nit: '900000001' });
    expect(await repo.findLeadContact(id)).toMatchObject({ contactStatus: 'INTERESTED' });
  });

  it('templates: creates, finds by name regardless of case and hides inactive ones', async () => {
    const u = await createTestUser();
    const p = await templatesRepo.createTemplate({ name: 'Primer correo', channel: 'EMAIL', subject: 'Hola', body: 'Texto', createdById: u });
    await templatesRepo.createTemplate({ name: 'WA', channel: 'WHATSAPP', subject: null, body: 'Texto', createdById: null });
    expect((await templatesRepo.findTemplateByName('PRIMER CORREO'))?.id).toBe(p.id);
    expect((await templatesRepo.findTemplate(p.id))?.createdBy).toEqual({ id: u, fullName: 'Andres Saray' });
    await templatesRepo.updateTemplate(p.id, { active: false });
    expect((await templatesRepo.findTemplates({})).map((x) => x.name)).toEqual(['WA']);
    expect(await templatesRepo.findTemplates({ includeInactive: true, channel: 'EMAIL' })).toHaveLength(1);
    // Deleting the lead deletes its history; deleting the template leaves the history without a template.
    const id = await createLead();
    await repo.saveOutbound(outbound(id, u, { templateId: p.id }), new Date());
    await prisma.template.delete({ where: { id: p.id } });
    expect((await repo.findInteractions(id))[0].templateId).toBeNull();
    await prisma.lead.delete({ where: { id } });
    expect(await prisma.interaction.count()).toBe(0);
  });
});
