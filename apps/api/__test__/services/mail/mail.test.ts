// Mail service: mode according to the configuration and what is passed to nodemailer.
const sendMail = jest.fn();
jest.mock('nodemailer', () => ({ __esModule: true, default: { createTransport: jest.fn(() => ({ sendMail })) } }));

type Email = typeof import('~services/mail');

function load(env: Record<string, string | undefined>): Email {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  let mod!: Email;
  jest.isolateModules(() => {
    mod = require('~services/mail');
  });
  process.env = previous;
  return mod;
}

const email = { to: 'hola@cafe.test', subject: 'Hola', text: 'Texto', replyTo: 'andres@gmail.com', unsubscribeUrl: 'https://x.co/api/bajas/1.abc' };

describe('mail service', () => {
  it('without SMTP_HOST: simulated in development, disabled in production', async () => {
    const dev = load({ SMTP_HOST: undefined, NODE_ENV: 'development' });
    expect(dev.emailMode()).toBe('simulated');
    await expect(dev.sendEmail(email)).resolves.toEqual({ status: 'SIMULATED', providerId: null });

    const prod = load({ SMTP_HOST: undefined, NODE_ENV: 'production' });
    expect(prod.emailMode()).toBe('disabled');
    await expect(prod.sendEmail(email)).rejects.toThrow('no está configurado');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('with SMTP: sender, reply-to and one-click unsubscribe headers', async () => {
    const m = load({ SMTP_HOST: 'smtp.test', EMAIL_FROM: 'Ventas <ventas@empresa.co>' });
    sendMail.mockResolvedValue({ messageId: '<abc@smtp>', rejected: [] });
    expect(m.emailMode()).toBe('smtp');
    await expect(m.sendEmail(email)).resolves.toEqual({ status: 'SENT', providerId: '<abc@smtp>' });
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Ventas <ventas@empresa.co>', to: 'hola@cafe.test', subject: 'Hola', text: 'Texto', replyTo: 'andres@gmail.com',
      headers: { 'List-Unsubscribe': '<https://x.co/api/bajas/1.abc>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
  });

  it('rejected recipient or server error → EmailSendError', async () => {
    const m = load({ SMTP_HOST: 'smtp.test' });
    sendMail.mockResolvedValueOnce({ messageId: '<x>', rejected: ['hola@cafe.test'] });
    await expect(m.sendEmail(email)).rejects.toBeInstanceOf(m.EmailSendError);
    sendMail.mockRejectedValueOnce(new Error('Invalid login: 535'));
    await expect(m.sendEmail(email)).rejects.toThrow('535');
  });
});

export {};
