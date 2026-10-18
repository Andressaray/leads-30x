// Envío a Dapta, resultados del webhook y calificación manual.
import { CalificacionesDomain, type DependenciasCalificaciones } from 'modules/calificaciones/domain/calificaciones.domain';
import { AppError, HttpCode } from '~response/index';
import { ErrorEnvioDapta } from '~services/dapta';
import type { UsuarioSesion } from '~types/auth.types';
import type { LeadParaDaptaDTO } from 'modules/calificaciones/types/calificaciones.types';
import { crearRepositorioCalificacionesEnMemoria, leadParaDapta } from '~mocks/modules/calificaciones/calificaciones.repository.mock';

const ANDRES: UsuarioSesion = { id: 1, email: 'andres@gmail.com', fullName: 'Andres Saray', rol: 'SERVICE' };
const ADMIN: UsuarioSesion = { id: 3, email: 'admin@gmail.com', fullName: 'Administrador', rol: 'ADMIN' };
const SECRETO = 'secreto-dapta';

function preparar(o: { leads?: LeadParaDaptaDTO[]; contacta?: boolean; modo?: 'activo' | 'simulado' | 'desactivado'; secreto?: string | null } = {}) {
  const repo = crearRepositorioCalificacionesEnMemoria(o.leads);
  const contactos = {
    exigirPermisoContacto: jest.fn().mockResolvedValue(undefined),
    registrarLlamadaExterna: jest.fn().mockResolvedValue(undefined),
    registrarRespuestaExterna: jest.fn().mockResolvedValue(undefined),
  };
  const enviarADapta = jest.fn().mockResolvedValue({ estado: 'ENVIADO' });
  let n = 0;
  let ahora = new Date('2026-10-14T15:00:00Z');
  const deps: Partial<DependenciasCalificaciones> = {
    repo,
    contactos: contactos as unknown as DependenciasCalificaciones['contactos'],
    dapta: { enviarADapta, modoDapta: () => o.modo ?? 'activo' },
    ahora: () => ahora,
    nuevaReferencia: () => `ref-${++n}`,
    config: { contacta: o.contacta ?? true, webhookSecret: o.secreto === null ? undefined : (o.secreto ?? SECRETO), urlPublica: 'https://app.test', apiPrefix: '/api' },
  };
  return { dominio: new CalificacionesDomain(deps), repo, contactos, enviarADapta, mover: (d: Date) => (ahora = d) };
}

const estado = (p: Promise<unknown>) => p.then(() => 0, (e: unknown) => (e instanceof AppError ? e.status : -1));

describe('enviar a Dapta', () => {
  it('manda los datos del lead con referencia, callback y el celular primero; registra la llamada', async () => {
    const { dominio, enviarADapta, contactos } = preparar();
    const c = await dominio.enviar(1, ANDRES);
    expect(enviarADapta).toHaveBeenCalledWith({
      referencia: 'ref-1', lead_id: 1, contact_name: 'Café Prueba', contact_phone: '+573001112233', contact_email: 'hola@cafe.test',
      municipio: 'RIONEGRO', departamento: 'Antioquia', categoria: 'Restaurantes y comidas', fuente: 'osm', estado_contacto: 'PENDIENTE',
      callback_url: 'https://app.test/api/dapta/webhook',
    });
    expect(c).toMatchObject({ origen: 'DAPTA', estado: 'ENVIADO', referencia: 'ref-1', usuarioId: 1 });
    expect(contactos.exigirPermisoContacto).toHaveBeenCalledWith(1, ANDRES, 'LLAMADA');
    expect(contactos.registrarLlamadaExterna).toHaveBeenCalledWith(1, ANDRES, 'Llamada del agente de Dapta.');
  });

  it('si Dapta llama, aplican las reglas de contacto (lo que diga el módulo de contactos)', async () => {
    const { dominio, contactos, enviarADapta } = preparar();
    contactos.exigirPermisoContacto.mockRejectedValue(new AppError(HttpCode.UNPROCESSABLE_ENTITY, 'Fuera del horario permitido.'));
    expect(await estado(dominio.enviar(1, ANDRES))).toBe(422);
    expect(enviarADapta).not.toHaveBeenCalled();
  });

  it('si Dapta solo califica (no llama), no exige teléfono ni registra llamada, pero respeta al responsable', async () => {
    const { dominio, contactos } = preparar({
      contacta: false,
      leads: [leadParaDapta({ telefonos: [] }), leadParaDapta({ id: 2, contactadoPorId: 2, contactadoPor: { id: 2, fullName: 'Camila Rojas' } })],
    });
    await expect(dominio.enviar(1, ANDRES)).resolves.toMatchObject({ estado: 'ENVIADO' });
    expect(contactos.exigirPermisoContacto).not.toHaveBeenCalled();
    expect(contactos.registrarLlamadaExterna).not.toHaveBeenCalled();
    expect(await estado(dominio.enviar(2, ANDRES))).toBe(409);
    await expect(dominio.enviar(2, ADMIN)).resolves.toBeDefined();
  });

  it('nunca a quien pidió no ser contactado; sin teléfono con +57 no se puede llamar', async () => {
    const { dominio } = preparar({ leads: [leadParaDapta({ noContactar: true }), leadParaDapta({ id: 2, telefonos: [{ numero: '6045550000', tipo: 'fijo' }] })] });
    expect(await estado(dominio.enviar(1, ADMIN))).toBe(409);
    expect(await estado(dominio.enviar(2, ADMIN))).toBe(422);
  });

  it('un envío pendiente bloquea otro durante 72 h', async () => {
    const { dominio, mover } = preparar();
    await dominio.enviar(1, ANDRES);
    expect(await estado(dominio.enviar(1, ANDRES))).toBe(409);
    // El repositorio fecha los envíos con la hora real (como la base): 73 h después ya no bloquea.
    mover(new Date(Date.now() + 73 * 3600_000));
    await expect(dominio.enviar(1, ANDRES)).resolves.toMatchObject({ referencia: 'ref-2' });
  });

  it('Dapta falla → 502, queda FALLIDO y no cuenta como llamada', async () => {
    const { dominio, enviarADapta, repo, contactos } = preparar();
    enviarADapta.mockRejectedValue(new ErrorEnvioDapta('Dapta respondió 500.'));
    expect(await estado(dominio.enviar(1, ANDRES))).toBe(502);
    expect(repo._estado.calificaciones[0]).toMatchObject({ estado: 'FALLIDO', error: 'Dapta respondió 500.' });
    expect(contactos.registrarLlamadaExterna).not.toHaveBeenCalled();
  });

  it('modo simulado lo registra y lo anota en el historial; desactivado → 503', async () => {
    const sim = preparar({ modo: 'simulado' });
    sim.enviarADapta.mockResolvedValue({ estado: 'SIMULADO' });
    await expect(sim.dominio.enviar(1, ANDRES)).resolves.toMatchObject({ estado: 'SIMULADO' });
    expect(sim.contactos.registrarLlamadaExterna).toHaveBeenCalledWith(1, ANDRES, 'Llamada del agente de Dapta (simulado: no salió).');
    expect(await estado(preparar({ modo: 'desactivado' }).dominio.enviar(1, ANDRES))).toBe(503);
  });

  it('en lote: omite con motivo y sigue; corta si la integración no está disponible', async () => {
    const { dominio } = preparar({ leads: [leadParaDapta(), leadParaDapta({ id: 2, noContactar: true }), leadParaDapta({ id: 3 })] });
    const r = await dominio.enviarLote([1, 2, 99, 3, 1], ANDRES);
    expect(r).toEqual({
      enviados: 2,
      omitidos: 2,
      resultados: [
        { leadId: 1, ok: true, motivo: null },
        { leadId: 2, ok: false, motivo: 'Este lead pidió no volver a ser contactado.' },
        { leadId: 99, ok: false, motivo: 'Lead no encontrado.' },
        { leadId: 3, ok: true, motivo: null },
      ],
    });
    expect(await estado(preparar({ modo: 'desactivado' }).dominio.enviarLote([1], ANDRES))).toBe(503);
    expect(await estado(dominio.enviarLote(Array.from({ length: 101 }, (_, i) => i + 1), ANDRES))).toBe(400);
  });
});

describe('resultado de Dapta (webhook)', () => {
  it('exige el secreto; sin secreto configurado el webhook está apagado', async () => {
    const { dominio } = preparar();
    expect(await estado(dominio.recibirResultado({ referencia: 'x' }, undefined))).toBe(401);
    expect(await estado(dominio.recibirResultado({ referencia: 'x' }, 'otro'))).toBe(401);
    expect(await estado(preparar({ secreto: null }).dominio.recibirResultado({ referencia: 'x' }, 'x'))).toBe(503);
  });

  it('califica el lead y, como habló con el agente, avanza el embudo (alta → interesado)', async () => {
    const { dominio, repo, contactos } = preparar();
    await dominio.enviar(1, ANDRES);
    const r = await dominio.recibirResultado({ referencia: 'ref-1', calificacion: 'alta', puntaje: 90, resumen: 'Quiere demo' }, SECRETO);
    expect(r).toMatchObject({ estado: 'CALIFICADO', calidad: 'ALTA', puntaje: 90, resumen: 'Quiere demo' });
    expect(repo._estado.leads[0]).toMatchObject({ calidad: 'ALTA', puntaje: 90 });
    expect(contactos.registrarRespuestaExterna).toHaveBeenCalledWith(1, 'INTERESADO', 'Habló con el agente de Dapta: Quiere demo');
  });

  it('media/baja → respondió; descartado o sin contacto no tocan el embudo', async () => {
    const { dominio, contactos } = preparar({ leads: [leadParaDapta(), leadParaDapta({ id: 2 }), leadParaDapta({ id: 3 })] });
    await dominio.enviarLote([1, 2, 3], ANDRES);
    await dominio.recibirResultado({ referencia: 'ref-1', score: 50 }, SECRETO);
    expect(contactos.registrarRespuestaExterna).toHaveBeenLastCalledWith(1, 'RESPONDIO', 'Habló con el agente de Dapta.');
    await dominio.recibirResultado({ referencia: 'ref-2', calificacion: 'descartado' }, SECRETO);
    const sin = await dominio.recibirResultado({ lead_id: 3, call_status: 'voicemail' }, SECRETO);
    expect(sin).toMatchObject({ estado: 'SIN_CONTACTO', calidad: null });
    expect(contactos.registrarRespuestaExterna).toHaveBeenCalledTimes(1);
  });

  it('si Dapta no llama (solo califica), no cambia el embudo', async () => {
    const { dominio, contactos } = preparar({ contacta: false });
    await dominio.enviar(1, ANDRES);
    await dominio.recibirResultado({ referencia: 'ref-1', calificacion: 'alta' }, SECRETO);
    expect(contactos.registrarRespuestaExterna).not.toHaveBeenCalled();
  });

  it('errores: referencia desconocida (404), lead que no cuadra (400), resultado sin calificación (400)', async () => {
    const { dominio } = preparar({ leads: [leadParaDapta(), leadParaDapta({ id: 2 })] });
    await dominio.enviar(1, ANDRES);
    expect(await estado(dominio.recibirResultado({ referencia: 'nada', calificacion: 'alta' }, SECRETO))).toBe(404);
    expect(await estado(dominio.recibirResultado({ referencia: 'ref-1', lead_id: 2, calificacion: 'alta' }, SECRETO))).toBe(400);
    expect(await estado(dominio.recibirResultado({ referencia: 'ref-1', call_status: 'completed' }, SECRETO))).toBe(400);
    expect(await estado(dominio.recibirResultado({ lead_id: 2, calificacion: 'alta' }, SECRETO))).toBe(404); // sin envío pendiente
  });
});

describe('calificación manual', () => {
  it('quien trabaja el lead o un ADMIN; queda en el lead', async () => {
    const { dominio, repo } = preparar({ leads: [leadParaDapta({ contactadoPorId: 2, contactadoPor: { id: 2, fullName: 'Camila Rojas' } })] });
    expect(await estado(dominio.calificarManual(1, { calidad: 'ALTA' }, ANDRES))).toBe(409);
    const c = await dominio.calificarManual(1, { calidad: 'BAJA', puntaje: 20, nota: ' Muy pequeño ' }, ADMIN);
    expect(c).toMatchObject({ origen: 'MANUAL', estado: 'CALIFICADO', calidad: 'BAJA', puntaje: 20, resumen: 'Muy pequeño' });
    expect(repo._estado.leads[0]).toMatchObject({ calidad: 'BAJA', puntaje: 20 });
  });

  it('estado(): modo, si llama y la URL del webhook', () => {
    expect(preparar().dominio.estado()).toEqual({ modo: 'activo', contacta: true, webhook: true, urlWebhook: 'https://app.test/api/dapta/webhook' });
  });
});
