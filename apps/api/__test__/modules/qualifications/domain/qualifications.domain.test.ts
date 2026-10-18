// Dispatch to Dapta, webhook results and manual qualification.
import { QualificationsDomain, type QualificationsDependencies } from 'modules/qualifications/domain/qualifications.domain';
import { AppError, HttpCode } from '~response/index';
import { DaptaSendError } from '~services/dapta';
import type { SessionUser } from '~types/auth.types';
import type { LeadForDaptaDTO } from 'modules/qualifications/types/qualifications.types';
import { createInMemoryQualificationsRepository, leadForDapta } from '~mocks/modules/qualifications/qualifications.repository.mock';

const ANDRES: SessionUser = { id: 1, email: 'andres@gmail.com', fullName: 'Andres Saray', role: 'SERVICE' };
const ADMIN: SessionUser = { id: 3, email: 'admin@gmail.com', fullName: 'Administrador', role: 'ADMIN' };
const SECRET = 'dapta-secret';

function prepare(o: { leads?: LeadForDaptaDTO[]; contacts?: boolean; mode?: 'active' | 'simulated' | 'disabled'; secret?: string | null } = {}) {
  const repo = createInMemoryQualificationsRepository(o.leads);
  const outreach = {
    requireContactPermission: jest.fn().mockResolvedValue(undefined),
    recordExternalCall: jest.fn().mockResolvedValue(undefined),
    recordExternalReply: jest.fn().mockResolvedValue(undefined),
  };
  const sendToDapta = jest.fn().mockResolvedValue({ status: 'SENT' });
  let n = 0;
  let now = new Date('2026-10-14T15:00:00Z');
  const deps: Partial<QualificationsDependencies> = {
    repo,
    outreach: outreach as unknown as QualificationsDependencies['outreach'],
    dapta: { sendToDapta, daptaMode: () => o.mode ?? 'active' },
    now: () => now,
    newReference: () => `ref-${++n}`,
    config: { contacts: o.contacts ?? true, webhookSecret: o.secret === null ? undefined : (o.secret ?? SECRET), publicUrl: 'https://app.test', apiPrefix: '/api' },
  };
  return { domain: new QualificationsDomain(deps), repo, outreach, sendToDapta, move: (d: Date) => (now = d) };
}

const status = (p: Promise<unknown>) => p.then(() => 0, (e: unknown) => (e instanceof AppError ? e.status : -1));

describe('send to Dapta', () => {
  it('sends the lead data with reference, callback and the mobile number first; records the call', async () => {
    const { domain, sendToDapta, outreach } = prepare();
    const c = await domain.send(1, ANDRES);
    expect(sendToDapta).toHaveBeenCalledWith({
      reference: 'ref-1', lead_id: 1, contact_name: 'Café Prueba', contact_phone: '+573001112233', contact_email: 'hola@cafe.test',
      municipality: 'RIONEGRO', department: 'Antioquia', category: 'Restaurantes y comidas', source: 'osm', contact_status: 'PENDING',
      callback_url: 'https://app.test/api/dapta/webhook',
    });
    expect(c).toMatchObject({ origin: 'DAPTA', status: 'SENT', reference: 'ref-1', userId: 1 });
    expect(outreach.requireContactPermission).toHaveBeenCalledWith(1, ANDRES, 'CALL');
    expect(outreach.recordExternalCall).toHaveBeenCalledWith(1, ANDRES, 'Llamada del agente de Dapta.');
  });

  it('if Dapta calls, the contact rules apply (whatever the outreach module says)', async () => {
    const { domain, outreach, sendToDapta } = prepare();
    outreach.requireContactPermission.mockRejectedValue(new AppError(HttpCode.UNPROCESSABLE_ENTITY, 'Fuera del horario permitido.'));
    expect(await status(domain.send(1, ANDRES))).toBe(422);
    expect(sendToDapta).not.toHaveBeenCalled();
  });

  it('if Dapta only qualifies (does not call), it requires no phone and records no call, but respects the owner', async () => {
    const { domain, outreach } = prepare({
      contacts: false,
      leads: [leadForDapta({ phones: [] }), leadForDapta({ id: 2, contactedById: 2, contactedBy: { id: 2, fullName: 'Camila Rojas' } })],
    });
    await expect(domain.send(1, ANDRES)).resolves.toMatchObject({ status: 'SENT' });
    expect(outreach.requireContactPermission).not.toHaveBeenCalled();
    expect(outreach.recordExternalCall).not.toHaveBeenCalled();
    expect(await status(domain.send(2, ANDRES))).toBe(409);
    await expect(domain.send(2, ADMIN)).resolves.toBeDefined();
  });

  it('never to someone who asked not to be contacted; without a +57 phone it cannot call', async () => {
    const { domain } = prepare({ leads: [leadForDapta({ doNotContact: true }), leadForDapta({ id: 2, phones: [{ number: '6045550000', type: 'landline' }] })] });
    expect(await status(domain.send(1, ADMIN))).toBe(409);
    expect(await status(domain.send(2, ADMIN))).toBe(422);
  });

  it('a pending dispatch blocks another one for 72 h', async () => {
    const { domain, move } = prepare();
    await domain.send(1, ANDRES);
    expect(await status(domain.send(1, ANDRES))).toBe(409);
    // The repository dates dispatches with the real time (like the database): 73 h later it no longer blocks.
    move(new Date(Date.now() + 73 * 3600_000));
    await expect(domain.send(1, ANDRES)).resolves.toMatchObject({ reference: 'ref-2' });
  });

  it('Dapta fails → 502, recorded as FAILED and it does not count as a call', async () => {
    const { domain, sendToDapta, repo, outreach } = prepare();
    sendToDapta.mockRejectedValue(new DaptaSendError('Dapta respondió 500.'));
    expect(await status(domain.send(1, ANDRES))).toBe(502);
    expect(repo._status.qualifications[0]).toMatchObject({ status: 'FAILED', error: 'Dapta respondió 500.' });
    expect(outreach.recordExternalCall).not.toHaveBeenCalled();
  });

  it('simulated mode records it and notes it in the history; disabled → 503', async () => {
    const sim = prepare({ mode: 'simulated' });
    sim.sendToDapta.mockResolvedValue({ status: 'SIMULATED' });
    await expect(sim.domain.send(1, ANDRES)).resolves.toMatchObject({ status: 'SIMULATED' });
    expect(sim.outreach.recordExternalCall).toHaveBeenCalledWith(1, ANDRES, 'Llamada del agente de Dapta (simulado: no salió).');
    expect(await status(prepare({ mode: 'disabled' }).domain.send(1, ANDRES))).toBe(503);
  });

  it('in batch: skips with a reason and keeps going; stops if the integration is not available', async () => {
    const { domain } = prepare({ leads: [leadForDapta(), leadForDapta({ id: 2, doNotContact: true }), leadForDapta({ id: 3 })] });
    const r = await domain.sendBatch([1, 2, 99, 3, 1], ANDRES);
    expect(r).toEqual({
      sent: 2,
      skipped: 2,
      results: [
        { leadId: 1, ok: true, reason: null },
        { leadId: 2, ok: false, reason: 'Este lead pidió no volver a ser contactado.' },
        { leadId: 99, ok: false, reason: 'Lead no encontrado.' },
        { leadId: 3, ok: true, reason: null },
      ],
    });
    expect(await status(prepare({ mode: 'disabled' }).domain.sendBatch([1], ANDRES))).toBe(503);
    expect(await status(domain.sendBatch(Array.from({ length: 101 }, (_, i) => i + 1), ANDRES))).toBe(400);
  });
});

describe('Dapta result (webhook)', () => {
  it('requires the secret; without a configured secret the webhook is off', async () => {
    const { domain } = prepare();
    expect(await status(domain.receiveResult({ reference: 'x' }, undefined))).toBe(401);
    expect(await status(domain.receiveResult({ reference: 'x' }, 'other'))).toBe(401);
    expect(await status(prepare({ secret: null }).domain.receiveResult({ reference: 'x' }, 'x'))).toBe(503);
  });

  it('qualifies the lead and, since it talked to the agent, advances the funnel (high → interested)', async () => {
    const { domain, repo, outreach } = prepare();
    await domain.send(1, ANDRES);
    const r = await domain.receiveResult({ reference: 'ref-1', qualification: 'high', score: 90, summary: 'Quiere demo' }, SECRET);
    expect(r).toMatchObject({ status: 'QUALIFIED', quality: 'HIGH', score: 90, summary: 'Quiere demo' });
    expect(repo._status.leads[0]).toMatchObject({ quality: 'HIGH', score: 90 });
    expect(outreach.recordExternalReply).toHaveBeenCalledWith(1, 'INTERESTED', 'Habló con el agente de Dapta: Quiere demo');
  });

  it('medium/low → replied; discarded or no contact do not touch the funnel', async () => {
    const { domain, outreach } = prepare({ leads: [leadForDapta(), leadForDapta({ id: 2 }), leadForDapta({ id: 3 })] });
    await domain.sendBatch([1, 2, 3], ANDRES);
    await domain.receiveResult({ reference: 'ref-1', score: 50 }, SECRET);
    expect(outreach.recordExternalReply).toHaveBeenLastCalledWith(1, 'REPLIED', 'Habló con el agente de Dapta.');
    await domain.receiveResult({ reference: 'ref-2', qualification: 'discarded' }, SECRET);
    const without = await domain.receiveResult({ lead_id: 3, call_status: 'voicemail' }, SECRET);
    expect(without).toMatchObject({ status: 'NO_CONTACT', quality: null });
    expect(outreach.recordExternalReply).toHaveBeenCalledTimes(1);
  });

  it('if Dapta does not call (only qualifies), the funnel does not change', async () => {
    const { domain, outreach } = prepare({ contacts: false });
    await domain.send(1, ANDRES);
    await domain.receiveResult({ reference: 'ref-1', qualification: 'high' }, SECRET);
    expect(outreach.recordExternalReply).not.toHaveBeenCalled();
  });

  it('errors: unknown reference (404), lead that does not match (400), result without a qualification (400)', async () => {
    const { domain } = prepare({ leads: [leadForDapta(), leadForDapta({ id: 2 })] });
    await domain.send(1, ANDRES);
    expect(await status(domain.receiveResult({ reference: 'nada', qualification: 'high' }, SECRET))).toBe(404);
    expect(await status(domain.receiveResult({ reference: 'ref-1', lead_id: 2, qualification: 'high' }, SECRET))).toBe(400);
    expect(await status(domain.receiveResult({ reference: 'ref-1', call_status: 'completed' }, SECRET))).toBe(400);
    expect(await status(domain.receiveResult({ lead_id: 2, qualification: 'high' }, SECRET))).toBe(404); // no pending dispatch
  });
});

describe('manual qualification', () => {
  it('whoever works the lead or an ADMIN; it is stored on the lead', async () => {
    const { domain, repo } = prepare({ leads: [leadForDapta({ contactedById: 2, contactedBy: { id: 2, fullName: 'Camila Rojas' } })] });
    expect(await status(domain.qualifyManually(1, { quality: 'HIGH' }, ANDRES))).toBe(409);
    const c = await domain.qualifyManually(1, { quality: 'LOW', score: 20, note: ' Muy pequeño ' }, ADMIN);
    expect(c).toMatchObject({ origin: 'MANUAL', status: 'QUALIFIED', quality: 'LOW', score: 20, summary: 'Muy pequeño' });
    expect(repo._status.leads[0]).toMatchObject({ quality: 'LOW', score: 20 });
  });

  it('status(): mode, whether it calls and the webhook URL', () => {
    expect(prepare().domain.status()).toEqual({ mode: 'active', contacts: true, webhook: true, urlWebhook: 'https://app.test/api/dapta/webhook' });
  });
});
