// Servicio de correo: modo según la configuración y lo que se le pasa a nodemailer.
const sendMail = jest.fn();
jest.mock('nodemailer', () => ({ __esModule: true, default: { createTransport: jest.fn(() => ({ sendMail })) } }));

type Correo = typeof import('~services/correo');

function cargar(env: Record<string, string | undefined>): Correo {
  const anterior = { ...process.env };
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  let mod!: Correo;
  jest.isolateModules(() => {
    mod = require('~services/correo');
  });
  process.env = anterior;
  return mod;
}

const correo = { para: 'hola@cafe.test', asunto: 'Hola', texto: 'Texto', responderA: 'andres@gmail.com', urlBaja: 'https://x.co/api/bajas/1.abc' };

describe('servicio de correo', () => {
  it('sin SMTP_HOST: simulado en desarrollo, desactivado en producción', async () => {
    const dev = cargar({ SMTP_HOST: undefined, NODE_ENV: 'development' });
    expect(dev.modoCorreo()).toBe('simulado');
    await expect(dev.enviarCorreo(correo)).resolves.toEqual({ estado: 'SIMULADO', proveedorId: null });

    const prod = cargar({ SMTP_HOST: undefined, NODE_ENV: 'production' });
    expect(prod.modoCorreo()).toBe('desactivado');
    await expect(prod.enviarCorreo(correo)).rejects.toThrow('no está configurado');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('con SMTP: remitente, responder a y cabeceras de baja de un clic', async () => {
    const m = cargar({ SMTP_HOST: 'smtp.test', CORREO_REMITENTE: 'Ventas <ventas@empresa.co>' });
    sendMail.mockResolvedValue({ messageId: '<abc@smtp>', rejected: [] });
    expect(m.modoCorreo()).toBe('smtp');
    await expect(m.enviarCorreo(correo)).resolves.toEqual({ estado: 'ENVIADO', proveedorId: '<abc@smtp>' });
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Ventas <ventas@empresa.co>', to: 'hola@cafe.test', subject: 'Hola', text: 'Texto', replyTo: 'andres@gmail.com',
      headers: { 'List-Unsubscribe': '<https://x.co/api/bajas/1.abc>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
  });

  it('destinatario rechazado o error del servidor → ErrorEnvioCorreo', async () => {
    const m = cargar({ SMTP_HOST: 'smtp.test' });
    sendMail.mockResolvedValueOnce({ messageId: '<x>', rejected: ['hola@cafe.test'] });
    await expect(m.enviarCorreo(correo)).rejects.toBeInstanceOf(m.ErrorEnvioCorreo);
    sendMail.mockRejectedValueOnce(new Error('Invalid login: 535'));
    await expect(m.enviarCorreo(correo)).rejects.toThrow('535');
  });
});

export {};
