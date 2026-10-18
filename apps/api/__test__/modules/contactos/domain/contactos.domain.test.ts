// Reglas de contacto: quién puede escribir, Ley 2300, envío de correo y registro de respuestas.
import { ContactosDomain, type DependenciasContactos } from 'modules/contactos/domain/contactos.domain';
import { AppError, HttpCode } from '~response/index';
import { ErrorEnvioCorreo } from '~services/correo';
import type { UsuarioSesion } from '~types/auth.types';
import type { LeadContactoDTO } from 'modules/contactos/types/contactos.types';
import { crearRepositorioContactosEnMemoria, leadDePrueba } from '~mocks/modules/contactos/contactos.repository.mock';

const ANDRES: UsuarioSesion = { id: 1, email: 'andres@gmail.com', fullName: 'Andres Saray', rol: 'SERVICE' };
const CAMILA: UsuarioSesion = { id: 2, email: 'camila@gmail.com', fullName: 'Camila Rojas', rol: 'SERVICE' };
const ADMIN: UsuarioSesion = { id: 3, email: 'admin@gmail.com', fullName: 'Administrador', rol: 'ADMIN' };
const SECRETO = 'pruebas-pruebas-pruebas-pruebas-pruebas';

const bogota = (iso: string) => new Date(`${iso}-05:00`);
/** Miércoles 14 de octubre de 2026, 10:00 a. m. en Bogotá: dentro del horario legal. */
const MIERCOLES = bogota('2026-10-14T10:00');

const PLANTILLA_CORREO = {
  id: 7, nombre: 'Primer contacto', canal: 'EMAIL' as const, asunto: 'Propuesta para {{nombre}}',
  cuerpo: 'Hola {{nombre}}, soy {{remitente}} de {{empresa}}. Ayudamos a {{categoria}} en {{municipio}}.',
  activa: true, creadoPorId: 1, createdAt: new Date(), updatedAt: new Date(),
};

function preparar(opciones: { leads?: LeadContactoDTO[]; ahora?: Date; horarioLegal?: boolean; urlPublica?: string } = {}) {
  const repo = crearRepositorioContactosEnMemoria(opciones.leads);
  let ahora = opciones.ahora ?? MIERCOLES;
  const enviarCorreo = jest.fn().mockResolvedValue({ estado: 'ENVIADO', proveedorId: '<id@smtp>' });
  const deps: Partial<DependenciasContactos> = {
    repo,
    plantillas: { obtener: jest.fn().mockResolvedValue(PLANTILLA_CORREO) },
    correo: { enviarCorreo, modoCorreo: () => 'smtp' },
    ahora: () => ahora,
    config: {
      horarioLegal: opciones.horarioLegal ?? true,
      nombreEmpresa: 'Mi Empresa',
      urlPublica: opciones.urlPublica,
      apiPrefix: '/api',
      secreto: SECRETO,
      responderA: undefined,
    },
  };
  return { dominio: new ContactosDomain(deps), repo, enviarCorreo, moverReloj: (d: Date) => (ahora = d) };
}

const correo = { asunto: 'Propuesta para Café Prueba', mensaje: 'Hola, les escribo para contarles algo.' };

async function esperarError(promesa: Promise<unknown>, status: HttpCode, texto?: string): Promise<AppError> {
  const err = await promesa.then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
  if (texto) expect((err as AppError).message).toContain(texto);
  return err as AppError;
}

describe('ContactosDomain.vistaPrevia', () => {
  it('rellena la plantilla con los datos del lead y de quien envía', async () => {
    const { dominio } = preparar();
    const r = await dominio.vistaPrevia(1, { plantillaId: 7 }, ANDRES);
    expect(r.asunto).toBe('Propuesta para Café Prueba');
    expect(r.mensaje).toBe('Hola Café Prueba, soy Andres Saray de Mi Empresa. Ayudamos a restaurantes y comidas en San José del Guaviare.');
    expect(r.pie).toContain('Andres Saray · Mi Empresa');
    expect(r.pie).toContain('BAJA'); // sin URL pública, la baja es respondiendo
  });

  it('con URL pública, el pie trae el enlace firmado de baja', async () => {
    const { dominio } = preparar({ urlPublica: 'https://leads.miempresa.co' });
    const r = await dominio.vistaPrevia(1, { cuerpo: 'Hola' }, ANDRES);
    expect(r.pie).toMatch(/https:\/\/leads\.miempresa\.co\/api\/bajas\/1\.[A-Za-z0-9_-]{24}/);
  });

  it('variable mal escrita → 400', async () => {
    const { dominio } = preparar();
    await esperarError(dominio.vistaPrevia(1, { cuerpo: 'Hola {{nombr}}' }, ANDRES), HttpCode.BAD_REQUEST, '{{nombr}}');
  });

  it('lead inexistente → 404', async () => {
    const { dominio } = preparar();
    await esperarError(dominio.vistaPrevia(99, { cuerpo: 'Hola' }, ANDRES), HttpCode.NOT_FOUND);
  });
});

describe('ContactosDomain.enviarCorreo', () => {
  it('envía con pie legal, responde a quien envía y deja el lead CONTACTADO y asignado', async () => {
    const { dominio, enviarCorreo, repo } = preparar({ urlPublica: 'https://leads.miempresa.co' });
    const r = await dominio.enviarCorreo(1, { ...correo, plantillaId: 7 }, ANDRES);

    const enviado = enviarCorreo.mock.calls[0][0];
    expect(enviado).toMatchObject({ para: 'hola@cafe.test', asunto: correo.asunto, responderA: 'andres@gmail.com' });
    expect(enviado.texto).toContain(`${correo.mensaje}\n\n--\nAndres Saray · Mi Empresa`);
    expect(enviado.urlBaja).toMatch(/\/api\/bajas\/1\./);

    expect(r.interaccion).toMatchObject({ canal: 'EMAIL', sentido: 'SALIENTE', estado: 'ENVIADO', destino: 'hola@cafe.test', plantillaId: 7 });
    expect(r.lead).toMatchObject({ estadoContacto: 'CONTACTADO', contactado: true, contactadoPorId: 1, ultimoContactoEn: MIERCOLES });
    expect(repo._estado.interacciones).toHaveLength(1);
  });

  it('solo a correos del lead', async () => {
    const { dominio, enviarCorreo } = preparar();
    await esperarError(dominio.enviarCorreo(1, { ...correo, para: 'otro@x.test' }, ANDRES), HttpCode.BAD_REQUEST);
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it('rechaza mensajes con variables sin reemplazar', async () => {
    const { dominio } = preparar();
    await esperarError(dominio.enviarCorreo(1, { ...correo, mensaje: 'Hola {{nombre}}, qué tal' }, ANDRES), HttpCode.BAD_REQUEST, 'sin reemplazar');
  });

  it('sin correo registrado → 422', async () => {
    const { dominio } = preparar({ leads: [leadDePrueba({ emails: [] })] });
    await esperarError(dominio.enviarCorreo(1, correo, ANDRES), HttpCode.UNPROCESSABLE_ENTITY, 'No tiene correo');
  });

  it('si el SMTP lo rechaza: 502, queda FALLIDO y el lead sigue PENDIENTE', async () => {
    const { dominio, enviarCorreo, repo } = preparar();
    enviarCorreo.mockRejectedValue(new ErrorEnvioCorreo('550 usuario no existe'));
    await esperarError(dominio.enviarCorreo(1, correo, ANDRES), HttpCode.BAD_GATEWAY, '550');
    expect(repo._estado.interacciones[0]).toMatchObject({ estado: 'FALLIDO', error: '550 usuario no existe' });
    expect(repo._estado.leads[0]).toMatchObject({ estadoContacto: 'PENDIENTE', contactado: false });
  });

  it('un fallo de envío no cuenta para el límite de un contacto por día', async () => {
    const { dominio, enviarCorreo } = preparar();
    enviarCorreo.mockRejectedValueOnce(new ErrorEnvioCorreo('timeout'));
    await esperarError(dominio.enviarCorreo(1, correo, ANDRES), HttpCode.BAD_GATEWAY);
    await expect(dominio.enviarCorreo(1, correo, ANDRES)).resolves.toBeDefined();
  });

  it('un error inesperado (no del SMTP) se propaga sin registrar nada', async () => {
    const { dominio, enviarCorreo, repo } = preparar();
    enviarCorreo.mockRejectedValue(new Error('bug'));
    await expect(dominio.enviarCorreo(1, correo, ANDRES)).rejects.toThrow('bug');
    expect(repo._estado.interacciones).toHaveLength(0);
  });
});

describe('quién puede contactar', () => {
  const deCamila = leadDePrueba({ contactado: true, contactadoPorId: 2, estadoContacto: 'CONTACTADO' });

  it('un lead lo trabaja quien lo contactó primero: otro miembro recibe 409', async () => {
    const { dominio } = preparar({ leads: [deCamila] });
    const err = await esperarError(dominio.enviarCorreo(1, correo, ANDRES), HttpCode.CONFLICT, 'Camila Rojas');
    expect(err.details).toMatchObject({ contactadoPor: { id: 2 } });
    await esperarError(dominio.registrarRespuesta(1, { canal: 'EMAIL', resultado: 'RESPONDIO' }, ANDRES), HttpCode.CONFLICT);
  });

  it('la dueña y un ADMIN sí pueden', async () => {
    const { dominio, moverReloj } = preparar({ leads: [deCamila] });
    await expect(dominio.enviarCorreo(1, correo, CAMILA)).resolves.toBeDefined();
    moverReloj(bogota('2026-10-15T10:00')); // otro día, mismo canal
    const r = await dominio.enviarCorreo(1, correo, ADMIN);
    expect(r.lead.contactadoPorId).toBe(2); // el ADMIN no se queda con el lead
  });

  it('la ficha explica por qué no se puede', async () => {
    const { dominio } = preparar({ leads: [deCamila] });
    const f = await dominio.ficha(1, ANDRES);
    expect(f.permiso.motivo).toContain('Camila Rojas');
    expect(f.canales).toEqual({ email: ['hola@cafe.test'], whatsapp: ['+573001112233'], telefono: ['+573001112233', '+576015550000'] });
  });

  it('nunca a quien pidió no ser contactado ni a quien dijo que no le interesa', async () => {
    const { dominio } = preparar({
      leads: [leadDePrueba({ noContactar: true }), leadDePrueba({ id: 2, estadoContacto: 'NO_INTERESADO', contactado: true, contactadoPorId: 1 })],
      horarioLegal: false,
    });
    await esperarError(dominio.enviarCorreo(1, correo, ADMIN), HttpCode.CONFLICT, 'pidió no volver');
    await esperarError(dominio.registrarContacto(2, { canal: 'LLAMADA' }, ANDRES), HttpCode.CONFLICT, 'no le interesa');
    expect((await dominio.ficha(1, ANDRES)).permiso.motivo).toContain('pidió no volver'.replace('pidió', 'Pidió'));
  });
});

describe('Ley 2300 de 2023', () => {
  it('fuera de horario → 422 con la regla', async () => {
    const { dominio, enviarCorreo } = preparar({ ahora: bogota('2026-10-14T19:30') });
    const err = await esperarError(dominio.enviarCorreo(1, correo, ANDRES), HttpCode.UNPROCESSABLE_ENTITY, 'Fuera del horario');
    expect(err.details).toEqual({ regla: 'ley_2300' });
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it('domingos y festivos no; sábado en la mañana sí', async () => {
    const { dominio, moverReloj } = preparar();
    moverReloj(bogota('2026-10-18T10:00'));
    await esperarError(dominio.registrarContacto(1, { canal: 'WHATSAPP' }, ANDRES), HttpCode.UNPROCESSABLE_ENTITY, 'domingo');
    moverReloj(bogota('2026-10-12T10:00'));
    await esperarError(dominio.registrarContacto(1, { canal: 'WHATSAPP' }, ANDRES), HttpCode.UNPROCESSABLE_ENTITY, 'festivo');
    moverReloj(bogota('2026-10-17T09:00'));
    await expect(dominio.registrarContacto(1, { canal: 'WHATSAPP' }, ANDRES)).resolves.toBeDefined();
  });

  it('un contacto por día', async () => {
    const { dominio, moverReloj } = preparar();
    await dominio.enviarCorreo(1, correo, ANDRES);
    moverReloj(bogota('2026-10-14T16:00'));
    await esperarError(dominio.enviarCorreo(1, correo, ANDRES), HttpCode.UNPROCESSABLE_ENTITY, 'Ya se contactó hoy por correo');
    moverReloj(bogota('2026-10-15T08:00'));
    await expect(dominio.enviarCorreo(1, correo, ANDRES)).resolves.toBeDefined();
  });

  it('un solo canal por semana; el lunes siguiente se puede cambiar', async () => {
    const { dominio, moverReloj } = preparar();
    await dominio.enviarCorreo(1, correo, ANDRES);
    moverReloj(bogota('2026-10-16T10:00')); // viernes
    const err = await esperarError(dominio.registrarContacto(1, { canal: 'LLAMADA' }, ANDRES), HttpCode.UNPROCESSABLE_ENTITY, 'varios canales');
    expect(err.details).toEqual({ regla: 'canal' });
    const ficha = await dominio.ficha(1, ANDRES);
    expect(ficha.permiso).toMatchObject({ motivo: null, porCanal: { EMAIL: null } });
    expect(ficha.permiso.porCanal.WHATSAPP).toContain('varios canales');
    moverReloj(bogota('2026-10-19T10:00')); // lunes
    await expect(dominio.registrarContacto(1, { canal: 'LLAMADA' }, ANDRES)).resolves.toBeDefined();
  });

  it('cuando el lead responde, las reglas de frecuencia y horario ya no limitan la conversación', async () => {
    const { dominio, moverReloj } = preparar();
    await dominio.enviarCorreo(1, correo, ANDRES);
    await dominio.registrarRespuesta(1, { canal: 'EMAIL', resultado: 'INTERESADO' }, ANDRES);
    moverReloj(bogota('2026-10-14T20:00'));
    await expect(dominio.registrarContacto(1, { canal: 'LLAMADA', nota: 'Me pidió llamar en la noche' }, ANDRES)).resolves.toBeDefined();
  });

  it('con CONTACTO_HORARIO_LEGAL=false no se aplican', async () => {
    const { dominio } = preparar({ ahora: bogota('2026-10-18T22:00'), horarioLegal: false });
    await dominio.enviarCorreo(1, correo, ANDRES);
    await expect(dominio.registrarContacto(1, { canal: 'WHATSAPP' }, ANDRES)).resolves.toBeDefined();
  });
});

describe('registrarContacto (WhatsApp, llamada, otro)', () => {
  it('toma el primer número del canal y acepta el número con otro formato', async () => {
    const { dominio, moverReloj } = preparar();
    const r = await dominio.registrarContacto(1, { canal: 'WHATSAPP', mensaje: 'Hola' }, ANDRES);
    expect(r.interaccion).toMatchObject({ canal: 'WHATSAPP', destino: '+573001112233', estado: 'REGISTRADO', mensaje: 'Hola' });
    expect(r.lead.estadoContacto).toBe('CONTACTADO');
    moverReloj(bogota('2026-10-15T10:00'));
    const r2 = await dominio.registrarContacto(1, { canal: 'WHATSAPP', destino: '300 111 2233' }, ANDRES);
    expect(r2.interaccion.destino).toBe('+573001112233');
  });

  it('rechaza números que no son del lead o que no sirven para el canal', async () => {
    const { dominio } = preparar();
    await esperarError(dominio.registrarContacto(1, { canal: 'LLAMADA', destino: '3119998877' }, ANDRES), HttpCode.BAD_REQUEST);
    await esperarError(dominio.registrarContacto(1, { canal: 'WHATSAPP', destino: '+576015550000' }, ANDRES), HttpCode.BAD_REQUEST);
  });

  it('WhatsApp usa los celulares si ninguno está marcado como WhatsApp; sin celular → 422', async () => {
    const { dominio } = preparar({
      leads: [
        leadDePrueba({ telefonos: [{ numero: '+573009998877', tipo: 'movil' }] }),
        leadDePrueba({ id: 2, telefonos: [{ numero: '+576015550000', tipo: 'fijo' }] }),
      ],
    });
    expect((await dominio.registrarContacto(1, { canal: 'WHATSAPP' }, ANDRES)).interaccion.destino).toBe('+573009998877');
    await esperarError(dominio.registrarContacto(2, { canal: 'WHATSAPP' }, ANDRES), HttpCode.UNPROCESSABLE_ENTITY, 'celular');
  });
});

describe('registrarRespuesta', () => {
  it('no se registra respuesta de un lead que no se ha contactado', async () => {
    const { dominio } = preparar();
    await esperarError(dominio.registrarRespuesta(1, { canal: 'EMAIL', resultado: 'RESPONDIO' }, ANDRES), HttpCode.CONFLICT, 'Todavía no');
  });

  it('cambia el estado y guarda la primera fecha de respuesta (un rebote no es respuesta)', async () => {
    const { dominio, moverReloj } = preparar();
    await dominio.enviarCorreo(1, correo, ANDRES);
    const rebote = await dominio.registrarRespuesta(1, { canal: 'EMAIL', resultado: 'REBOTADO' }, ANDRES);
    expect(rebote.lead).toMatchObject({ estadoContacto: 'REBOTADO', respondioEn: null });
    moverReloj(bogota('2026-10-14T11:00'));
    const r = await dominio.registrarRespuesta(1, { canal: 'WHATSAPP', resultado: 'RESPONDIO', nota: 'Escribió por WhatsApp' }, ANDRES);
    expect(r.interaccion).toMatchObject({ sentido: 'ENTRANTE', resultado: 'RESPONDIO', nota: 'Escribió por WhatsApp' });
    expect(r.lead.respondioEn).toEqual(bogota('2026-10-14T11:00'));
    moverReloj(bogota('2026-10-14T12:00'));
    const r2 = await dominio.registrarRespuesta(1, { canal: 'WHATSAPP', resultado: 'INTERESADO' }, ANDRES);
    expect(r2.lead).toMatchObject({ estadoContacto: 'INTERESADO', respondioEn: bogota('2026-10-14T11:00') });
  });
});

describe('no volver a contactar', () => {
  it('marcar a mano deja constancia una sola vez', async () => {
    const { dominio, repo } = preparar();
    expect((await dominio.marcarNoContactar(1, 'Lo pidió por teléfono', ANDRES)).noContactar).toBe(true);
    await dominio.marcarNoContactar(1, undefined, ANDRES);
    expect(repo._estado.interacciones).toHaveLength(1);
    expect(repo._estado.interacciones[0]).toMatchObject({ canal: 'OTRO', sentido: 'ENTRANTE', nota: 'Lo pidió por teléfono' });
  });

  it('enlace de baja: válido marca el lead; inválido o de otro lead → 404', async () => {
    const { crearTokenBaja } = await import('~utils/tokenBaja');
    const { dominio, repo } = preparar({ leads: [leadDePrueba(), leadDePrueba({ id: 2, nombre: 'Otro' })] });
    await esperarError(dominio.darseDeBaja('1.AAAAAAAAAAAAAAAAAAAAAAAA'), HttpCode.NOT_FOUND);
    await esperarError(dominio.darseDeBaja(crearTokenBaja(99, SECRETO)), HttpCode.NOT_FOUND);
    expect(await dominio.darseDeBaja(crearTokenBaja(2, SECRETO))).toEqual({ nombre: 'Otro' });
    expect(repo._estado.leads.map((l) => l.noContactar)).toEqual([false, true]);
  });
});

describe('contactos hechos por Dapta', () => {
  it('la llamada de Dapta cuenta como llamada para la regla de un canal por semana', async () => {
    const { dominio, repo, moverReloj } = preparar();
    await dominio.registrarLlamadaExterna(1, ANDRES, 'Llamada del agente de Dapta.');
    expect(repo._estado.interacciones[0]).toMatchObject({ canal: 'DAPTA', sentido: 'SALIENTE', destino: '+573001112233' });
    expect(repo._estado.leads[0]).toMatchObject({ estadoContacto: 'CONTACTADO', contactadoPorId: 1 });
    moverReloj(bogota('2026-10-15T10:00'));
    await expect(dominio.exigirPermisoContacto(1, ANDRES, 'LLAMADA')).resolves.toBeDefined();
    await esperarError(dominio.exigirPermisoContacto(1, ANDRES, 'EMAIL'), HttpCode.UNPROCESSABLE_ENTITY, 'llamada');
  });

  it('la respuesta externa solo avanza el embudo', async () => {
    const { dominio, repo } = preparar({ leads: [leadDePrueba({ estadoContacto: 'CONTACTADO', contactado: true, contactadoPorId: 1 })] });
    await dominio.registrarRespuestaExterna(1, 'RESPONDIO', 'Habló con el agente');
    expect(repo._estado.leads[0].estadoContacto).toBe('RESPONDIO');
    await dominio.registrarRespuestaExterna(1, 'INTERESADO', 'Le interesa');
    expect(repo._estado.leads[0].estadoContacto).toBe('INTERESADO');
    await dominio.registrarRespuestaExterna(1, 'RESPONDIO', 'Otra llamada');
    expect(repo._estado.leads[0].estadoContacto).toBe('INTERESADO');
    expect(repo._estado.interacciones.filter((i) => i.sentido === 'ENTRANTE').map((i) => i.canal)).toEqual(['DAPTA', 'DAPTA']);
  });
});
