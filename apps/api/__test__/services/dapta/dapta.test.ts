// Dapta client: mode according to the configuration and handling of flow errors.
type Dapta = typeof import('~services/dapta');

function load(env: Record<string, string | undefined>): Dapta {
  const previous = { ...process.env };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  let mod!: Dapta;
  jest.isolateModules(() => {
    mod = require('~services/dapta');
  });
  process.env = previous;
  return mod;
}

const dispatch = {
  reference: 'r1', lead_id: 1, contact_name: 'Café', contact_phone: '+573001112233', contact_email: null, municipality: 'X',
  department: 'Y', category: null, source: 'osm', contact_status: 'PENDING', callback_url: null,
};

describe('Dapta service', () => {
  afterEach(() => jest.restoreAllMocks());

  it('without DAPTA_FLOW_URL: simulated in development, disabled in production', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const dev = load({ DAPTA_FLOW_URL: undefined, NODE_ENV: 'development' });
    expect(dev.daptaMode()).toBe('simulated');
    await expect(dev.sendToDapta(dispatch)).resolves.toEqual({ status: 'SIMULATED' });
    const prod = load({ DAPTA_FLOW_URL: undefined, NODE_ENV: 'production' });
    await expect(prod.sendToDapta(dispatch)).rejects.toThrow('DAPTA_FLOW_URL');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('with a URL: POST JSON to the Public Route', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const m = load({ DAPTA_FLOW_URL: 'https://api.dapta.ai/flow/abc?key=k' });
    await expect(m.sendToDapta(dispatch)).resolves.toEqual({ status: 'SENT' });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.dapta.ai/flow/abc?key=k');
    expect(init).toMatchObject({ method: 'POST', headers: expect.objectContaining({ 'Content-Type': 'application/json' }) });
    expect(JSON.parse(String(init!.body))).toEqual(dispatch);
  });

  it('non-2xx response or no connection → DaptaSendError with the detail', async () => {
    const m = load({ DAPTA_FLOW_URL: 'https://api.dapta.ai/flow/abc' });
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('flujo apagado', { status: 404 }));
    await expect(m.sendToDapta(dispatch)).rejects.toThrow('Dapta respondió 404: flujo apagado.');
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(m.sendToDapta(dispatch)).rejects.toBeInstanceOf(m.DaptaSendError);
  });
});

export {};
