// Cliente de Dapta: modo según la configuración y manejo de errores del flujo.
type Dapta = typeof import('~services/dapta');

function cargar(env: Record<string, string | undefined>): Dapta {
  const anterior = { ...process.env };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  let mod!: Dapta;
  jest.isolateModules(() => {
    mod = require('~services/dapta');
  });
  process.env = anterior;
  return mod;
}

const envio = {
  referencia: 'r1', lead_id: 1, contact_name: 'Café', contact_phone: '+573001112233', contact_email: null, municipio: 'X',
  departamento: 'Y', categoria: null, fuente: 'osm', estado_contacto: 'PENDIENTE', callback_url: null,
};

describe('servicio de Dapta', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sin DAPTA_FLOW_URL: simulado en desarrollo, desactivado en producción', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const dev = cargar({ DAPTA_FLOW_URL: undefined, NODE_ENV: 'development' });
    expect(dev.modoDapta()).toBe('simulado');
    await expect(dev.enviarADapta(envio)).resolves.toEqual({ estado: 'SIMULADO' });
    const prod = cargar({ DAPTA_FLOW_URL: undefined, NODE_ENV: 'production' });
    await expect(prod.enviarADapta(envio)).rejects.toThrow('DAPTA_FLOW_URL');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('con URL: POST JSON al Public Route', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const m = cargar({ DAPTA_FLOW_URL: 'https://api.dapta.ai/flow/abc?key=k' });
    await expect(m.enviarADapta(envio)).resolves.toEqual({ estado: 'ENVIADO' });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.dapta.ai/flow/abc?key=k');
    expect(init).toMatchObject({ method: 'POST', headers: expect.objectContaining({ 'Content-Type': 'application/json' }) });
    expect(JSON.parse(String(init!.body))).toEqual(envio);
  });

  it('respuesta no 2xx o sin conexión → ErrorEnvioDapta con el detalle', async () => {
    const m = cargar({ DAPTA_FLOW_URL: 'https://api.dapta.ai/flow/abc' });
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('flujo apagado', { status: 404 }));
    await expect(m.enviarADapta(envio)).rejects.toThrow('Dapta respondió 404: flujo apagado.');
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(m.enviarADapta(envio)).rejects.toBeInstanceOf(m.ErrorEnvioDapta);
  });
});

export {};
