// Contact rules: who can write, Ley 2300, sending emails and recording replies.
import { OutreachDomain, type OutreachDependencies } from 'modules/outreach/domain/outreach.domain';
import { AppError, HttpCode } from '~response/index';
import { EmailSendError } from '~services/mail';
import type { SessionUser } from '~types/auth.types';
import type { LeadContactDTO } from 'modules/outreach/types/outreach.types';
import { createInMemoryOutreachRepository, testLead } from '~mocks/modules/outreach/outreach.repository.mock';

const ANDRES: SessionUser = { id: 1, email: 'andres@gmail.com', fullName: 'Andres Saray', role: 'SERVICE' };
const CAMILA: SessionUser = { id: 2, email: 'camila@gmail.com', fullName: 'Camila Rojas', role: 'SERVICE' };
const ADMIN: SessionUser = { id: 3, email: 'admin@gmail.com', fullName: 'Administrador', role: 'ADMIN' };
const SECRET = 'testing-testing-testing-testing-testing';

const bogota = (iso: string) => new Date(`${iso}-05:00`);
/** Wednesday, October 14, 2026, 10:00 a.m. in Bogotá: within the legal hours. */
const WEDNESDAY = bogota('2026-10-14T10:00');

const EMAIL_TEMPLATE = {
  id: 7, name: 'Primer contacto', channel: 'EMAIL' as const, subject: 'Propuesta para {{nombre}}',
  body: 'Hola {{nombre}}, soy {{remitente}} de {{empresa}}. Ayudamos a {{categoria}} en {{municipio}}.',
  active: true, createdById: 1, createdAt: new Date(), updatedAt: new Date(),
};

function prepare(options: { leads?: LeadContactDTO[]; now?: Date; legalHours?: boolean; publicUrl?: string } = {}) {
  const repo = createInMemoryOutreachRepository(options.leads);
  let now = options.now ?? WEDNESDAY;
  const sendEmail = jest.fn().mockResolvedValue({ status: 'SENT', providerId: '<id@smtp>' });
  const deps: Partial<OutreachDependencies> = {
    repo,
    templates: { get: jest.fn().mockResolvedValue(EMAIL_TEMPLATE) },
    email: { sendEmail, emailMode: () => 'smtp' },
    now: () => now,
    config: {
      legalHours: options.legalHours ?? true,
      companyName: 'Mi Empresa',
      publicUrl: options.publicUrl,
      apiPrefix: '/api',
      secret: SECRET,
      replyTo: undefined,
    },
  };
  return { domain: new OutreachDomain(deps), repo, sendEmail, advanceClock: (d: Date) => (now = d) };
}

const email = { subject: 'Propuesta para Café Prueba', message: 'Hola, les escribo para contarles algo.' };

async function expectError(promise: Promise<unknown>, status: HttpCode, text?: string): Promise<AppError> {
  const err = await promise.then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
  if (text) expect((err as AppError).message).toContain(text);
  return err as AppError;
}

describe('OutreachDomain.preview', () => {
  it('fills the template with the lead\'s and the sender\'s data', async () => {
    const { domain } = prepare();
    const r = await domain.preview(1, { templateId: 7 }, ANDRES);
    expect(r.subject).toBe('Propuesta para Café Prueba');
    expect(r.message).toBe('Hola Café Prueba, soy Andres Saray de Mi Empresa. Ayudamos a restaurantes y comidas en San José del Guaviare.');
    expect(r.footer).toContain('Andres Saray · Mi Empresa');
    expect(r.footer).toContain('BAJA'); // without a public URL, unsubscribing is by replying
  });

  it('with a public URL, the footer carries the signed unsubscribe link', async () => {
    const { domain } = prepare({ publicUrl: 'https://leads.miempresa.co' });
    const r = await domain.preview(1, { body: 'Hola' }, ANDRES);
    expect(r.footer).toMatch(/https:\/\/leads\.miempresa\.co\/api\/unsubscribe\/1\.[A-Za-z0-9_-]{24}/);
  });

  it('misspelled variable → 400', async () => {
    const { domain } = prepare();
    await expectError(domain.preview(1, { body: 'Hola {{nombr}}' }, ANDRES), HttpCode.BAD_REQUEST, '{{nombr}}');
  });

  it('unknown lead → 404', async () => {
    const { domain } = prepare();
    await expectError(domain.preview(99, { body: 'Hola' }, ANDRES), HttpCode.NOT_FOUND);
  });
});

describe('OutreachDomain.sendEmail', () => {
  it('sends with the legal footer, replies go to the sender and the lead becomes CONTACTED and assigned', async () => {
    const { domain, sendEmail, repo } = prepare({ publicUrl: 'https://leads.miempresa.co' });
    const r = await domain.sendEmail(1, { ...email, templateId: 7 }, ANDRES);

    const sent = sendEmail.mock.calls[0][0];
    expect(sent).toMatchObject({ to: 'hola@cafe.test', subject: email.subject, replyTo: 'andres@gmail.com' });
    expect(sent.text).toContain(`${email.message}\n\n--\nAndres Saray · Mi Empresa`);
    expect(sent.unsubscribeUrl).toMatch(/\/api\/unsubscribe\/1\./);

    expect(r.interaction).toMatchObject({ channel: 'EMAIL', direction: 'OUTBOUND', status: 'SENT', destination: 'hola@cafe.test', templateId: 7 });
    expect(r.lead).toMatchObject({ contactStatus: 'CONTACTED', contacted: true, contactedById: 1, lastContactedAt: WEDNESDAY });
    expect(repo._status.interactions).toHaveLength(1);
  });

  it('only to the lead\'s emails', async () => {
    const { domain, sendEmail } = prepare();
    await expectError(domain.sendEmail(1, { ...email, to: 'otro@x.test' }, ANDRES), HttpCode.BAD_REQUEST);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('rejects messages with unreplaced variables', async () => {
    const { domain } = prepare();
    await expectError(domain.sendEmail(1, { ...email, message: 'Hola {{nombre}}, qué tal' }, ANDRES), HttpCode.BAD_REQUEST, 'sin reemplazar');
  });

  it('no email on record → 422', async () => {
    const { domain } = prepare({ leads: [testLead({ emails: [] })] });
    await expectError(domain.sendEmail(1, email, ANDRES), HttpCode.UNPROCESSABLE_ENTITY, 'No tiene correo');
  });

  it('if SMTP rejects it: 502, it is recorded as FAILED and the lead stays PENDING', async () => {
    const { domain, sendEmail, repo } = prepare();
    sendEmail.mockRejectedValue(new EmailSendError('550 usuario no existe'));
    await expectError(domain.sendEmail(1, email, ANDRES), HttpCode.BAD_GATEWAY, '550');
    expect(repo._status.interactions[0]).toMatchObject({ status: 'FAILED', error: '550 usuario no existe' });
    expect(repo._status.leads[0]).toMatchObject({ contactStatus: 'PENDING', contacted: false });
  });

  it('a send failure does not count towards the one-contact-per-day limit', async () => {
    const { domain, sendEmail } = prepare();
    sendEmail.mockRejectedValueOnce(new EmailSendError('timeout'));
    await expectError(domain.sendEmail(1, email, ANDRES), HttpCode.BAD_GATEWAY);
    await expect(domain.sendEmail(1, email, ANDRES)).resolves.toBeDefined();
  });

  it('an unexpected error (not from SMTP) propagates without recording anything', async () => {
    const { domain, sendEmail, repo } = prepare();
    sendEmail.mockRejectedValue(new Error('bug'));
    await expect(domain.sendEmail(1, email, ANDRES)).rejects.toThrow('bug');
    expect(repo._status.interactions).toHaveLength(0);
  });
});

describe('who can contact', () => {
  const byCamila = testLead({ contacted: true, contactedById: 2, contactStatus: 'CONTACTED' });

  it('a lead is worked by whoever contacted it first: another member gets 409', async () => {
    const { domain } = prepare({ leads: [byCamila] });
    const err = await expectError(domain.sendEmail(1, email, ANDRES), HttpCode.CONFLICT, 'Camila Rojas');
    expect(err.details).toMatchObject({ contactedBy: { id: 2 } });
    await expectError(domain.recordReply(1, { channel: 'EMAIL', result: 'REPLIED' }, ANDRES), HttpCode.CONFLICT);
  });

  it('the owner and an ADMIN can', async () => {
    const { domain, advanceClock } = prepare({ leads: [byCamila] });
    await expect(domain.sendEmail(1, email, CAMILA)).resolves.toBeDefined();
    advanceClock(bogota('2026-10-15T10:00')); // another day, same channel
    const r = await domain.sendEmail(1, email, ADMIN);
    expect(r.lead.contactedById).toBe(2); // the ADMIN does not take over the lead
  });

  it('the contact sheet explains why it cannot be contacted', async () => {
    const { domain } = prepare({ leads: [byCamila] });
    const f = await domain.sheet(1, ANDRES);
    expect(f.permission.reason).toContain('Camila Rojas');
    expect(f.channels).toEqual({ email: ['hola@cafe.test'], whatsapp: ['+573001112233'], phone: ['+573001112233', '+576015550000'] });
  });

  it('never to someone who asked not to be contacted nor to someone who said they are not interested', async () => {
    const { domain } = prepare({
      leads: [testLead({ doNotContact: true }), testLead({ id: 2, contactStatus: 'NOT_INTERESTED', contacted: true, contactedById: 1 })],
      legalHours: false,
    });
    await expectError(domain.sendEmail(1, email, ADMIN), HttpCode.CONFLICT, 'pidió no volver');
    await expectError(domain.recordContact(2, { channel: 'CALL' }, ANDRES), HttpCode.CONFLICT, 'no le interesa');
    expect((await domain.sheet(1, ANDRES)).permission.reason).toContain('pidió no volver'.replace('pidió', 'Pidió'));
  });
});

describe('Ley 2300 de 2023', () => {
  it('outside legal hours → 422 with the rule', async () => {
    const { domain, sendEmail } = prepare({ now: bogota('2026-10-14T19:30') });
    const err = await expectError(domain.sendEmail(1, email, ANDRES), HttpCode.UNPROCESSABLE_ENTITY, 'Fuera del horario');
    expect(err.details).toEqual({ rule: 'law_2300' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('no Sundays or holidays; Saturday morning is fine', async () => {
    const { domain, advanceClock } = prepare();
    advanceClock(bogota('2026-10-18T10:00'));
    await expectError(domain.recordContact(1, { channel: 'WHATSAPP' }, ANDRES), HttpCode.UNPROCESSABLE_ENTITY, 'domingo');
    advanceClock(bogota('2026-10-12T10:00'));
    await expectError(domain.recordContact(1, { channel: 'WHATSAPP' }, ANDRES), HttpCode.UNPROCESSABLE_ENTITY, 'festivo');
    advanceClock(bogota('2026-10-17T09:00'));
    await expect(domain.recordContact(1, { channel: 'WHATSAPP' }, ANDRES)).resolves.toBeDefined();
  });

  it('one contact per day', async () => {
    const { domain, advanceClock } = prepare();
    await domain.sendEmail(1, email, ANDRES);
    advanceClock(bogota('2026-10-14T16:00'));
    await expectError(domain.sendEmail(1, email, ANDRES), HttpCode.UNPROCESSABLE_ENTITY, 'Ya se contactó hoy por correo');
    advanceClock(bogota('2026-10-15T08:00'));
    await expect(domain.sendEmail(1, email, ANDRES)).resolves.toBeDefined();
  });

  it('a single channel per week; it can change the following Monday', async () => {
    const { domain, advanceClock } = prepare();
    await domain.sendEmail(1, email, ANDRES);
    advanceClock(bogota('2026-10-16T10:00')); // Friday
    const err = await expectError(domain.recordContact(1, { channel: 'CALL' }, ANDRES), HttpCode.UNPROCESSABLE_ENTITY, 'varios canales');
    expect(err.details).toEqual({ rule: 'channel' });
    const sheet = await domain.sheet(1, ANDRES);
    expect(sheet.permission).toMatchObject({ reason: null, byChannel: { EMAIL: null } });
    expect(sheet.permission.byChannel.WHATSAPP).toContain('varios canales');
    advanceClock(bogota('2026-10-19T10:00')); // Monday
    await expect(domain.recordContact(1, { channel: 'CALL' }, ANDRES)).resolves.toBeDefined();
  });

  it('once the lead replies, the frequency and hours rules no longer limit the conversation', async () => {
    const { domain, advanceClock } = prepare();
    await domain.sendEmail(1, email, ANDRES);
    await domain.recordReply(1, { channel: 'EMAIL', result: 'INTERESTED' }, ANDRES);
    advanceClock(bogota('2026-10-14T20:00'));
    await expect(domain.recordContact(1, { channel: 'CALL', note: 'Me pidió llamar en la noche' }, ANDRES)).resolves.toBeDefined();
  });

  it('with CONTACT_LEGAL_HOURS=false they do not apply', async () => {
    const { domain } = prepare({ now: bogota('2026-10-18T22:00'), legalHours: false });
    await domain.sendEmail(1, email, ANDRES);
    await expect(domain.recordContact(1, { channel: 'WHATSAPP' }, ANDRES)).resolves.toBeDefined();
  });
});

describe('recordContact (WhatsApp, call, other)', () => {
  it('takes the first number of the channel and accepts the number in another format', async () => {
    const { domain, advanceClock } = prepare();
    const r = await domain.recordContact(1, { channel: 'WHATSAPP', message: 'Hola' }, ANDRES);
    expect(r.interaction).toMatchObject({ channel: 'WHATSAPP', destination: '+573001112233', status: 'RECORDED', message: 'Hola' });
    expect(r.lead.contactStatus).toBe('CONTACTED');
    advanceClock(bogota('2026-10-15T10:00'));
    const r2 = await domain.recordContact(1, { channel: 'WHATSAPP', destination: '300 111 2233' }, ANDRES);
    expect(r2.interaction.destination).toBe('+573001112233');
  });

  it('rejects numbers that are not the lead\'s or that do not work for the channel', async () => {
    const { domain } = prepare();
    await expectError(domain.recordContact(1, { channel: 'CALL', destination: '3119998877' }, ANDRES), HttpCode.BAD_REQUEST);
    await expectError(domain.recordContact(1, { channel: 'WHATSAPP', destination: '+576015550000' }, ANDRES), HttpCode.BAD_REQUEST);
  });

  it('WhatsApp uses the mobile numbers if none is marked as WhatsApp; without a mobile → 422', async () => {
    const { domain } = prepare({
      leads: [
        testLead({ phones: [{ number: '+573009998877', type: 'mobile' }] }),
        testLead({ id: 2, phones: [{ number: '+576015550000', type: 'landline' }] }),
      ],
    });
    expect((await domain.recordContact(1, { channel: 'WHATSAPP' }, ANDRES)).interaction.destination).toBe('+573009998877');
    await expectError(domain.recordContact(2, { channel: 'WHATSAPP' }, ANDRES), HttpCode.UNPROCESSABLE_ENTITY, 'celular');
  });
});

describe('recordReply', () => {
  it('a reply is not recorded for a lead that has not been contacted', async () => {
    const { domain } = prepare();
    await expectError(domain.recordReply(1, { channel: 'EMAIL', result: 'REPLIED' }, ANDRES), HttpCode.CONFLICT, 'Todavía no');
  });

  it('changes the status and stores the first reply date (a bounce is not a reply)', async () => {
    const { domain, advanceClock } = prepare();
    await domain.sendEmail(1, email, ANDRES);
    const bounce = await domain.recordReply(1, { channel: 'EMAIL', result: 'BOUNCED' }, ANDRES);
    expect(bounce.lead).toMatchObject({ contactStatus: 'BOUNCED', repliedAt: null });
    advanceClock(bogota('2026-10-14T11:00'));
    const r = await domain.recordReply(1, { channel: 'WHATSAPP', result: 'REPLIED', note: 'Escribió por WhatsApp' }, ANDRES);
    expect(r.interaction).toMatchObject({ direction: 'INBOUND', result: 'REPLIED', note: 'Escribió por WhatsApp' });
    expect(r.lead.repliedAt).toEqual(bogota('2026-10-14T11:00'));
    advanceClock(bogota('2026-10-14T12:00'));
    const r2 = await domain.recordReply(1, { channel: 'WHATSAPP', result: 'INTERESTED' }, ANDRES);
    expect(r2.lead).toMatchObject({ contactStatus: 'INTERESTED', repliedAt: bogota('2026-10-14T11:00') });
  });
});

describe('do not contact again', () => {
  it('marking it by hand records it only once', async () => {
    const { domain, repo } = prepare();
    expect((await domain.markDoNotContact(1, 'Lo pidió por teléfono', ANDRES)).doNotContact).toBe(true);
    await domain.markDoNotContact(1, undefined, ANDRES);
    expect(repo._status.interactions).toHaveLength(1);
    expect(repo._status.interactions[0]).toMatchObject({ channel: 'OTHER', direction: 'INBOUND', note: 'Lo pidió por teléfono' });
  });

  it('unsubscribe link: a valid one marks the lead; an invalid one or another lead\'s → 404', async () => {
    const { createUnsubscribeToken } = await import('~utils/unsubscribeToken');
    const { domain, repo } = prepare({ leads: [testLead(), testLead({ id: 2, name: 'Otro' })] });
    await expectError(domain.unsubscribe('1.AAAAAAAAAAAAAAAAAAAAAAAA'), HttpCode.NOT_FOUND);
    await expectError(domain.unsubscribe(createUnsubscribeToken(99, SECRET)), HttpCode.NOT_FOUND);
    expect(await domain.unsubscribe(createUnsubscribeToken(2, SECRET))).toEqual({ name: 'Otro' });
    expect(repo._status.leads.map((l) => l.doNotContact)).toEqual([false, true]);
  });
});

describe('contacts made by Dapta', () => {
  it('the Dapta call counts as a call for the one-channel-per-week rule', async () => {
    const { domain, repo, advanceClock } = prepare();
    await domain.recordExternalCall(1, ANDRES, 'Llamada del agente de Dapta.');
    expect(repo._status.interactions[0]).toMatchObject({ channel: 'DAPTA', direction: 'OUTBOUND', destination: '+573001112233' });
    expect(repo._status.leads[0]).toMatchObject({ contactStatus: 'CONTACTED', contactedById: 1 });
    advanceClock(bogota('2026-10-15T10:00'));
    await expect(domain.requireContactPermission(1, ANDRES, 'CALL')).resolves.toBeDefined();
    await expectError(domain.requireContactPermission(1, ANDRES, 'EMAIL'), HttpCode.UNPROCESSABLE_ENTITY, 'llamada');
  });

  it('the external reply only advances the funnel', async () => {
    const { domain, repo } = prepare({ leads: [testLead({ contactStatus: 'CONTACTED', contacted: true, contactedById: 1 })] });
    await domain.recordExternalReply(1, 'REPLIED', 'Habló con el agente');
    expect(repo._status.leads[0].contactStatus).toBe('REPLIED');
    await domain.recordExternalReply(1, 'INTERESTED', 'Le interesa');
    expect(repo._status.leads[0].contactStatus).toBe('INTERESTED');
    await domain.recordExternalReply(1, 'REPLIED', 'Otra llamada');
    expect(repo._status.leads[0].contactStatus).toBe('INTERESTED');
    expect(repo._status.interactions.filter((i) => i.direction === 'INBOUND').map((i) => i.channel)).toEqual(['DAPTA', 'DAPTA']);
  });
});
