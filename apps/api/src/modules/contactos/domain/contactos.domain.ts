// Reglas para contactar leads desde la plataforma:
//   - El correo sale por SMTP; WhatsApp y llamadas se hacen fuera y se registran aquí.
//   - Nunca se contacta a quien pidió no recibir más mensajes, ni a quien dijo que no le interesa.
//   - Un lead lo trabaja una sola persona (la primera que lo contactó); un ADMIN puede intervenir.
//   - Ley 2300 de 2023 (si CONTACTO_HORARIO_LEGAL no es false), mientras el lead no haya respondido:
//       · solo lunes a viernes 7 a. m.–7 p. m. y sábados 8 a. m.–3 p. m., sin domingos ni festivos;
//       · como máximo un contacto por día;
//       · en una misma semana, un solo canal.
//     Cuando el lead responde, la conversación la pidió él y estas reglas ya no limitan.

import * as repositorioReal from '../repository/contactos.repository';
import { environment } from '~config/environment';
import { AppError, HttpCode } from '~response/index';
import { ErrorEnvioCorreo, enviarCorreo as enviarCorreoReal, modoCorreo as modoCorreoReal } from '~services/correo';
import type { UsuarioSesion } from '~types/auth.types';
import { inicioDeSemanaColombia, mismoDiaColombia, motivoFueraDeHorario } from '~utils/horarioContacto';
import { crearTokenBaja, leerTokenBaja } from '~utils/tokenBaja';
import { PlantillasDomain } from 'modules/plantillas/domain/plantillas.domain';
import { capitalizar, capitalizarNombre, renderizar, variablesDesconocidas, VARIABLES } from 'modules/plantillas/domain/plantillas.render';
import { CATEGORIAS } from '~config/catalogo/categorias';
import type { ContactosDomainInterface } from './contactos.interface';
import type {
  CanalConPermiso,
  CanalContacto,
  CreateInteraccionDTO,
  EnviarCorreoDTO,
  FichaContactoDTO,
  LeadContactoDTO,
  MensajePreparadoDTO,
  PermisoContactoDTO,
  RegistrarContactoDTO,
  RegistrarRespuestaDTO,
  ResultadoContactoDTO,
  SalidaPreviaDTO,
  VistaPreviaDTO,
} from '../types/contactos.types';

export type ContactosRepository = typeof repositorioReal;

export interface DependenciasContactos {
  repo: ContactosRepository;
  plantillas: Pick<PlantillasDomain, 'obtener'>;
  correo: { enviarCorreo: typeof enviarCorreoReal; modoCorreo: typeof modoCorreoReal };
  ahora: () => Date;
  config: {
    horarioLegal: boolean;
    nombreEmpresa: string;
    urlPublica: string | undefined;
    apiPrefix: string;
    secreto: string;
    responderA: string | undefined;
  };
}

const porDefecto = (): DependenciasContactos => ({
  repo: repositorioReal,
  plantillas: new PlantillasDomain(),
  correo: { enviarCorreo: enviarCorreoReal, modoCorreo: modoCorreoReal },
  ahora: () => new Date(),
  config: {
    horarioLegal: environment.horarioLegal,
    nombreEmpresa: environment.nombreEmpresa,
    urlPublica: environment.urlPublica,
    apiPrefix: environment.apiPrefix,
    secreto: environment.jwtSecret,
    responderA: environment.correo.responderA,
  },
});

const NOMBRE_CANAL: Record<CanalContacto, string> = {
  EMAIL: 'correo', WHATSAPP: 'WhatsApp', LLAMADA: 'llamada', OTRO: 'otro canal', DAPTA: 'llamada del agente de Dapta',
};
/** Para la regla de "un canal por semana", la llamada de Dapta es una llamada. */
const canalLegal = (c: CanalContacto): CanalContacto => (c === 'DAPTA' ? 'LLAMADA' : c);
const ESTADOS_EN_CONVERSACION = new Set(['RESPONDIO', 'INTERESADO']);

/** Para comparar números con o sin indicativo: "+57 300 111 2233" y "3001112233" son el mismo. */
const mismoNumero = (a: string, b: string) => {
  const n = (s: string) => s.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
  return n(a).length >= 7 && n(a) === n(b);
};

/** Números de WhatsApp: los marcados como tal y, si no hay, los celulares. */
function numerosWhatsapp(lead: LeadContactoDTO): string[] {
  const marcados = lead.telefonos.filter((t) => t.whatsapp).map((t) => t.numero);
  return marcados.length ? marcados : lead.telefonos.filter((t) => t.tipo === 'movil').map((t) => t.numero);
}

function hora(fecha: Date): string {
  return fecha.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' });
}

export class ContactosDomain implements ContactosDomainInterface {
  private readonly d: DependenciasContactos;

  constructor(deps: Partial<DependenciasContactos> = {}) {
    this.d = { ...porDefecto(), ...deps };
  }

  async ficha(leadId: number, usuario: UsuarioSesion): Promise<FichaContactoDTO> {
    const lead = await this.lead(leadId);
    const [interacciones, permiso] = await Promise.all([this.d.repo.findInteracciones(leadId), this.permiso(lead, usuario)]);
    return {
      lead,
      interacciones,
      canales: { email: lead.emails, whatsapp: numerosWhatsapp(lead), telefono: lead.telefonos.map((t) => t.numero) },
      permiso,
      correo: { modo: this.d.correo.modoCorreo() },
      horarioLegal: this.d.config.horarioLegal,
    };
  }

  async vistaPrevia(leadId: number, dto: VistaPreviaDTO, usuario: UsuarioSesion): Promise<MensajePreparadoDTO> {
    const lead = await this.lead(leadId);
    let asunto = dto.asunto ?? null;
    let cuerpo = dto.cuerpo ?? '';
    if (dto.plantillaId) {
      const p = await this.d.plantillas.obtener(dto.plantillaId);
      asunto = p.asunto;
      cuerpo = p.cuerpo;
    }
    const malas = variablesDesconocidas(`${asunto ?? ''} ${cuerpo}`);
    if (malas.length) {
      throw new AppError(HttpCode.BAD_REQUEST, `Variable desconocida: ${malas.map((m) => `{{${m}}}`).join(', ')}.`, { desconocidas: malas });
    }
    const vars = this.variables(lead, usuario);
    return { asunto: asunto === null ? null : renderizar(asunto, vars), mensaje: renderizar(cuerpo, vars), pie: this.pieCorreo(lead.id, usuario).texto };
  }

  async enviarCorreo(leadId: number, dto: EnviarCorreoDTO, usuario: UsuarioSesion): Promise<ResultadoContactoDTO> {
    const lead = await this.lead(leadId);
    await this.exigirPermiso(lead, usuario, 'EMAIL');
    const para = dto.para?.trim().toLowerCase() ?? lead.emails[0];
    if (!lead.emails.some((e) => e.toLowerCase() === para)) {
      throw new AppError(HttpCode.BAD_REQUEST, 'Ese correo no es de este lead. Elige uno de sus correos.', { campo: 'para' });
    }
    this.sinVariablesSueltas(dto.asunto, dto.mensaje);

    const pie = this.pieCorreo(lead.id, usuario);
    const base: CreateInteraccionDTO = {
      leadId: lead.id, usuarioId: usuario.id, canal: 'EMAIL', sentido: 'SALIENTE', estado: 'ENVIADO', destino: para,
      asunto: dto.asunto, mensaje: dto.mensaje, nota: null, resultado: null, error: null, proveedorId: null,
      plantillaId: dto.plantillaId ?? null,
    };
    try {
      const r = await this.d.correo.enviarCorreo({
        para,
        asunto: dto.asunto,
        texto: `${dto.mensaje}\n\n--\n${pie.texto}`,
        responderA: this.d.config.responderA ?? usuario.email,
        urlBaja: pie.url,
      });
      const interaccion = await this.d.repo.guardarSalida({ ...base, estado: r.estado, proveedorId: r.proveedorId }, this.d.ahora());
      return { interaccion, lead: await this.lead(leadId) };
    } catch (err) {
      if (!(err instanceof ErrorEnvioCorreo)) throw err;
      await this.d.repo.createInteraccion({ ...base, estado: 'FALLIDO', error: err.message });
      throw new AppError(HttpCode.BAD_GATEWAY, `No se pudo enviar el correo. ${err.message}`);
    }
  }

  async registrarContacto(leadId: number, dto: RegistrarContactoDTO, usuario: UsuarioSesion): Promise<ResultadoContactoDTO> {
    const lead = await this.lead(leadId);
    const canalPermiso: CanalConPermiso | null = dto.canal === 'OTRO' ? null : dto.canal;
    await this.exigirPermiso(lead, usuario, canalPermiso);
    let destino: string | null = dto.destino?.trim() || null;
    if (dto.canal !== 'OTRO') {
      const posibles = dto.canal === 'WHATSAPP' ? numerosWhatsapp(lead) : lead.telefonos.map((t) => t.numero);
      destino = destino ? (posibles.find((n) => mismoNumero(n, destino!)) ?? null) : posibles[0];
      if (!destino) throw new AppError(HttpCode.BAD_REQUEST, 'Ese número no es de este lead. Elige uno de sus números.', { campo: 'destino' });
    }
    const interaccion = await this.d.repo.guardarSalida(
      {
        leadId: lead.id, usuarioId: usuario.id, canal: dto.canal, sentido: 'SALIENTE', estado: 'REGISTRADO', destino,
        asunto: null, mensaje: dto.mensaje?.trim() || null, nota: dto.nota?.trim() || null, resultado: null, error: null,
        proveedorId: null, plantillaId: dto.plantillaId ?? null,
      },
      this.d.ahora()
    );
    return { interaccion, lead: await this.lead(leadId) };
  }

  async registrarRespuesta(leadId: number, dto: RegistrarRespuestaDTO, usuario: UsuarioSesion): Promise<ResultadoContactoDTO> {
    const lead = await this.lead(leadId);
    if (lead.estadoContacto === 'PENDIENTE') {
      throw new AppError(HttpCode.CONFLICT, 'Todavía no se ha contactado a este lead: primero registra el mensaje o la llamada.');
    }
    this.exigirDueno(lead, usuario);
    const interaccion = await this.d.repo.guardarRespuesta(
      {
        leadId: lead.id, usuarioId: usuario.id, canal: dto.canal, sentido: 'ENTRANTE', estado: 'REGISTRADO', destino: null,
        asunto: null, mensaje: null, nota: dto.nota?.trim() || null, resultado: dto.resultado, error: null, proveedorId: null,
        plantillaId: null,
      },
      dto.resultado,
      this.d.ahora()
    );
    return { interaccion, lead: await this.lead(leadId) };
  }

  async marcarNoContactar(leadId: number, nota: string | undefined, usuario: UsuarioSesion): Promise<LeadContactoDTO> {
    const lead = await this.lead(leadId);
    await this.d.repo.marcarNoContactar(
      {
        leadId: lead.id, usuarioId: usuario.id, canal: 'OTRO', sentido: 'ENTRANTE', estado: 'REGISTRADO', destino: null,
        asunto: null, mensaje: null, nota: nota?.trim() || 'Pidió no volver a ser contactado.', resultado: null, error: null,
        proveedorId: null, plantillaId: null,
      },
      this.d.ahora()
    );
    return this.lead(leadId);
  }

  async darseDeBaja(token: string): Promise<{ nombre: string }> {
    const leadId = leerTokenBaja(token, this.d.config.secreto);
    const lead = leadId ? await this.d.repo.findLeadContacto(leadId) : null;
    if (!lead) throw new AppError(HttpCode.NOT_FOUND, 'El enlace no es válido.');
    await this.d.repo.marcarNoContactar(
      {
        leadId: lead.id, usuarioId: null, canal: 'EMAIL', sentido: 'ENTRANTE', estado: 'REGISTRADO', destino: null, asunto: null,
        mensaje: null, nota: 'Se dio de baja con el enlace del correo.', resultado: null, error: null, proveedorId: null, plantillaId: null,
      },
      this.d.ahora()
    );
    return { nombre: lead.nombre };
  }

  // --- Para otros módulos (Dapta): contactos hechos por un sistema externo ------------------------

  async exigirPermisoContacto(leadId: number, usuario: UsuarioSesion, canal: CanalConPermiso): Promise<LeadContactoDTO> {
    const lead = await this.lead(leadId);
    await this.exigirPermiso(lead, usuario, canal);
    return lead;
  }

  async registrarLlamadaExterna(leadId: number, usuario: UsuarioSesion, nota: string): Promise<void> {
    const lead = await this.lead(leadId);
    const destino = lead.telefonos.find((t) => t.tipo === 'movil')?.numero ?? lead.telefonos[0]?.numero ?? null;
    await this.d.repo.guardarSalida(
      {
        leadId, usuarioId: usuario.id, canal: 'DAPTA', sentido: 'SALIENTE', estado: 'REGISTRADO', destino, asunto: null,
        mensaje: null, nota, resultado: null, error: null, proveedorId: null, plantillaId: null,
      },
      this.d.ahora()
    );
  }

  /** Respuesta que reporta un sistema externo. Solo avanza el embudo: nunca baja a un lead que ya respondió. */
  async registrarRespuestaExterna(leadId: number, resultado: 'RESPONDIO' | 'INTERESADO', nota: string): Promise<void> {
    const lead = await this.lead(leadId);
    const avanza = lead.estadoContacto === 'PENDIENTE' || lead.estadoContacto === 'CONTACTADO' || (lead.estadoContacto === 'RESPONDIO' && resultado === 'INTERESADO');
    if (!avanza) return;
    await this.d.repo.guardarRespuesta(
      {
        leadId, usuarioId: null, canal: 'DAPTA', sentido: 'ENTRANTE', estado: 'REGISTRADO', destino: null, asunto: null,
        mensaje: null, nota, resultado, error: null, proveedorId: null, plantillaId: null,
      },
      resultado,
      this.d.ahora()
    );
  }

  // ---------------------------------------------------------------------------------------------

  private async lead(id: number): Promise<LeadContactoDTO> {
    const lead = await this.d.repo.findLeadContacto(id);
    if (!lead) throw new AppError(HttpCode.NOT_FOUND, 'Lead no encontrado.');
    return lead;
  }

  private exigirDueno(lead: LeadContactoDTO, usuario: UsuarioSesion): void {
    const motivo = this.motivoDueno(lead, usuario);
    if (motivo) throw new AppError(HttpCode.CONFLICT, motivo, { contactadoPor: lead.contactadoPor });
  }

  private motivoDueno(lead: LeadContactoDTO, usuario: UsuarioSesion): string | null {
    if (!lead.contactadoPorId || lead.contactadoPorId === usuario.id || usuario.rol === 'ADMIN') return null;
    return `Este lead lo está trabajando ${lead.contactadoPor?.fullName ?? 'otra persona del equipo'}.`;
  }

  /** Motivo general (vale para todos los canales) y motivo por canal. */
  private async permiso(lead: LeadContactoDTO, usuario: UsuarioSesion): Promise<PermisoContactoDTO> {
    const ahora = this.d.ahora();
    let motivo: string | null = null;
    let salidas: SalidaPreviaDTO[] = [];
    if (lead.noContactar) motivo = 'Pidió no volver a ser contactado.';
    else if (lead.estadoContacto === 'NO_INTERESADO') motivo = 'Dijo que no le interesa. Si cambia de opinión, registra su respuesta.';
    else motivo = this.motivoDueno(lead, usuario);

    const reglasLegales = this.d.config.horarioLegal && !ESTADOS_EN_CONVERSACION.has(lead.estadoContacto);
    if (!motivo && reglasLegales) {
      motivo = motivoFueraDeHorario(ahora);
      if (!motivo) {
        salidas = await this.d.repo.findSalidasDesde(lead.id, inicioDeSemanaColombia(ahora));
        const hoy = salidas.find((s) => mismoDiaColombia(s.createdAt, ahora));
        if (hoy) {
          motivo = `Ya se contactó hoy por ${NOMBRE_CANAL[hoy.canal]} (${hora(hoy.createdAt)}). La Ley 2300 permite un contacto por día; intenta mañana.`;
        }
      }
    }

    const salidaSemana = reglasLegales ? salidas.find((s) => s.canal !== 'OTRO') : undefined;
    const canalSemana = salidaSemana ? canalLegal(salidaSemana.canal) : undefined;
    const porCanal = (canal: CanalConPermiso, sinDatos: string | null): string | null => {
      if (sinDatos) return sinDatos;
      if (canalSemana && canalSemana !== canal) {
        return `Esta semana ya se contactó por ${NOMBRE_CANAL[canalSemana]}. La Ley 2300 no permite usar varios canales en la misma semana: sigue por ${NOMBRE_CANAL[canalSemana]} o espera al lunes.`;
      }
      return null;
    };
    return {
      motivo,
      porCanal: {
        EMAIL: porCanal('EMAIL', lead.emails.length ? null : 'No tiene correo registrado.'),
        WHATSAPP: porCanal('WHATSAPP', numerosWhatsapp(lead).length ? null : 'No tiene celular ni WhatsApp registrado.'),
        LLAMADA: porCanal('LLAMADA', lead.telefonos.length ? null : 'No tiene teléfono registrado.'),
      },
    };
  }

  private async exigirPermiso(lead: LeadContactoDTO, usuario: UsuarioSesion, canal: CanalConPermiso | null): Promise<void> {
    if (lead.noContactar) throw new AppError(HttpCode.CONFLICT, 'Este lead pidió no volver a ser contactado.');
    if (lead.estadoContacto === 'NO_INTERESADO') {
      throw new AppError(HttpCode.CONFLICT, 'Este lead dijo que no le interesa. Si cambia de opinión, registra su respuesta primero.');
    }
    this.exigirDueno(lead, usuario);
    const p = await this.permiso(lead, usuario);
    if (p.motivo) throw new AppError(HttpCode.UNPROCESSABLE_ENTITY, p.motivo, { regla: 'ley_2300' });
    const motivoCanal = canal ? p.porCanal[canal] : null;
    if (motivoCanal) throw new AppError(HttpCode.UNPROCESSABLE_ENTITY, motivoCanal, { regla: 'canal' });
  }

  private sinVariablesSueltas(...textos: string[]): void {
    // El mensaje llega ya preparado (vista previa): si quedó un {{...}} es un error de digitación.
    const sueltas = textos.flatMap((t) => [...t.matchAll(/\{\{\s*([^}]*)\s*\}\}/g)].map((m) => m[1].trim()));
    if (sueltas.length) {
      throw new AppError(
        HttpCode.BAD_REQUEST,
        `El mensaje tiene variables sin reemplazar: ${sueltas.map((s) => `{{${s}}}`).join(', ')}. Usa la vista previa antes de enviar.`,
        { campo: 'mensaje' }
      );
    }
  }

  private variables(lead: LeadContactoDTO, usuario: UsuarioSesion): Record<keyof typeof VARIABLES, string> {
    const categoria = lead.categorias.map((c) => CATEGORIAS[c]?.nombre).find(Boolean);
    return {
      nombre: capitalizarNombre(lead.nombre),
      municipio: capitalizar(lead.municipio),
      departamento: capitalizarNombre(lead.departamento),
      categoria: categoria ? categoria.toLocaleLowerCase('es-CO') : 'negocios',
      remitente: usuario.fullName,
      empresa: this.d.config.nombreEmpresa,
    };
  }

  /** Identifica a quien envía y explica cómo no recibir más mensajes (Ley 2300, art. 5). */
  private pieCorreo(leadId: number, usuario: UsuarioSesion): { texto: string; url?: string } {
    const { urlPublica, apiPrefix, secreto, nombreEmpresa } = this.d.config;
    const firma = `${usuario.fullName} · ${nombreEmpresa}`;
    if (!urlPublica) {
      return { texto: `${firma}\nSi no quieres recibir más mensajes nuestros, responde a este correo con la palabra BAJA.` };
    }
    const url = `${urlPublica}${apiPrefix}/bajas/${crearTokenBaja(leadId, secreto)}`;
    return { texto: `${firma}\nSi no quieres recibir más mensajes nuestros, entra aquí: ${url}`, url };
  }
}
