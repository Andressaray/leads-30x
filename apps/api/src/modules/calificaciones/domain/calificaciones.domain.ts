// Calificación de leads con Dapta (punto 4).
//
// Flujo: la plataforma manda el lead a un flujo de Flow Studio (POST a su Public Route) con una
// "referencia". El flujo lo califica (normalmente llamándolo con un agente de voz) y manda el
// resultado a POST /api/dapta/webhook con esa referencia. Mientras tanto queda ENVIADO.
//
// Si el flujo llama al lead (DAPTA_CONTACTA=true), el envío cuenta como una llamada: aplican las
// mismas reglas que a cualquier contacto (no contactar, responsable, Ley 2300) y queda en el historial.

import { randomUUID, timingSafeEqual } from 'node:crypto';
import * as repositorioReal from '../repository/calificaciones.repository';
import { environment } from '~config/environment';
import { CATEGORIAS } from '~config/catalogo/categorias';
import { AppError, HttpCode } from '~response/index';
import { ErrorEnvioDapta, enviarADapta as enviarReal, modoDapta as modoReal } from '~services/dapta';
import type { UsuarioSesion } from '~types/auth.types';
import { ContactosDomain } from 'modules/contactos/domain/contactos.domain';
import type { CalificacionesDomainInterface } from './calificaciones.interface';
import { normalizarResultadoDapta } from './calificaciones.webhook';
import type {
  CalificacionDTO,
  CalificarManualDTO,
  EstadoDaptaDTO,
  LeadParaDaptaDTO,
  ResultadoEnvioLoteDTO,
} from '../types/calificaciones.types';

export type CalificacionesRepository = typeof repositorioReal;
type Contactos = Pick<ContactosDomain, 'exigirPermisoContacto' | 'registrarLlamadaExterna' | 'registrarRespuestaExterna'>;

export interface DependenciasCalificaciones {
  repo: CalificacionesRepository;
  contactos: Contactos;
  dapta: { enviarADapta: typeof enviarReal; modoDapta: typeof modoReal };
  ahora: () => Date;
  nuevaReferencia: () => string;
  config: { contacta: boolean; webhookSecret: string | undefined; urlPublica: string | undefined; apiPrefix: string };
}

const porDefecto = (): DependenciasCalificaciones => ({
  repo: repositorioReal,
  contactos: new ContactosDomain(),
  dapta: { enviarADapta: enviarReal, modoDapta: modoReal },
  ahora: () => new Date(),
  nuevaReferencia: () => randomUUID(),
  config: {
    contacta: environment.dapta.contacta,
    webhookSecret: environment.dapta.webhookSecret,
    urlPublica: environment.urlPublica,
    apiPrefix: environment.apiPrefix,
  },
});

export const MAX_LOTE = 100;
const ESPERA_MAXIMA_MS = 72 * 3600_000;

function mismoSecreto(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Teléfono para la llamada de Dapta: WhatsApp/celular primero. Dapta exige el formato +57… */
function telefonoParaDapta(lead: LeadParaDaptaDTO): string | null {
  const t = lead.telefonos.find((x) => x.whatsapp) ?? lead.telefonos.find((x) => x.tipo === 'movil') ?? lead.telefonos[0];
  return t?.numero.startsWith('+') ? t.numero : null;
}

export class CalificacionesDomain implements CalificacionesDomainInterface {
  private readonly d: DependenciasCalificaciones;

  constructor(deps: Partial<DependenciasCalificaciones> = {}) {
    this.d = { ...porDefecto(), ...deps };
  }

  estado(): EstadoDaptaDTO {
    const { urlPublica, apiPrefix, webhookSecret, contacta } = this.d.config;
    return {
      modo: this.d.dapta.modoDapta(),
      contacta,
      webhook: Boolean(webhookSecret),
      urlWebhook: urlPublica ? `${urlPublica}${apiPrefix}/dapta/webhook` : null,
    };
  }

  async listar(leadId: number): Promise<CalificacionDTO[]> {
    await this.lead(leadId);
    return this.d.repo.findCalificaciones(leadId);
  }

  async enviar(leadId: number, usuario: UsuarioSesion): Promise<CalificacionDTO> {
    if (this.d.dapta.modoDapta() === 'desactivado') {
      throw new AppError(HttpCode.SERVICE_UNAVAILABLE, 'La integración con Dapta no está configurada en el servidor (falta DAPTA_FLOW_URL).');
    }
    const lead = await this.lead(leadId);
    if (lead.noContactar) throw new AppError(HttpCode.CONFLICT, 'Este lead pidió no volver a ser contactado.');
    // Un envío sin respuesta deja de bloquear a las 72 h (el flujo pudo fallar sin avisar).
    const pendiente = await this.d.repo.findEnvioPendiente(leadId, new Date(this.d.ahora().getTime() - ESPERA_MAXIMA_MS));
    if (pendiente) {
      throw new AppError(HttpCode.CONFLICT, 'Este lead ya está en Dapta esperando su calificación.', { enviadoEn: pendiente.createdAt });
    }
    const telefono = telefonoParaDapta(lead);
    if (this.d.config.contacta) {
      if (!telefono) throw new AppError(HttpCode.UNPROCESSABLE_ENTITY, 'No tiene un teléfono al que Dapta pueda llamar.', { regla: 'canal' });
      // Una llamada del agente de Dapta es una llamada: mismas reglas que si la hiciera el equipo.
      await this.d.contactos.exigirPermisoContacto(leadId, usuario, 'LLAMADA');
    } else if (lead.contactadoPorId && lead.contactadoPorId !== usuario.id && usuario.rol !== 'ADMIN') {
      throw new AppError(HttpCode.CONFLICT, `Este lead lo está trabajando ${lead.contactadoPor?.fullName ?? 'otra persona del equipo'}.`);
    }

    const referencia = this.d.nuevaReferencia();
    const base = {
      leadId, usuarioId: usuario.id, origen: 'DAPTA' as const, referencia, calidad: null, puntaje: null, resumen: null,
      variables: null, llamadaId: null, calificadoEn: null,
    };
    try {
      const r = await this.d.dapta.enviarADapta({
        referencia,
        lead_id: lead.id,
        contact_name: lead.nombre,
        contact_phone: telefono,
        contact_email: lead.emails[0] ?? null,
        municipio: lead.municipio,
        departamento: lead.departamento,
        categoria: lead.categorias.map((c) => CATEGORIAS[c]?.nombre).find(Boolean) ?? null,
        fuente: lead.fuenteOrigen,
        estado_contacto: lead.estadoContacto,
        callback_url: this.estado().urlWebhook,
      });
      const creada = await this.d.repo.createCalificacion({ ...base, estado: r.estado, error: null });
      if (this.d.config.contacta) {
        const simulado = r.estado === 'SIMULADO' ? ' (simulado: no salió)' : '';
        await this.d.contactos.registrarLlamadaExterna(leadId, usuario, `Llamada del agente de Dapta${simulado}.`);
      }
      return creada;
    } catch (err) {
      if (!(err instanceof ErrorEnvioDapta)) throw err;
      await this.d.repo.createCalificacion({ ...base, estado: 'FALLIDO', error: err.message });
      throw new AppError(HttpCode.BAD_GATEWAY, err.message);
    }
  }

  async enviarLote(leadIds: number[], usuario: UsuarioSesion): Promise<ResultadoEnvioLoteDTO> {
    const ids = [...new Set(leadIds)];
    if (ids.length > MAX_LOTE) throw new AppError(HttpCode.BAD_REQUEST, `Máximo ${MAX_LOTE} leads por envío.`);
    const resultados: ResultadoEnvioLoteDTO['resultados'] = [];
    // De a uno: cada envío debe ver lo que dejó el anterior, y Dapta limita la frecuencia.
    for (const leadId of ids) {
      try {
        await this.enviar(leadId, usuario);
        resultados.push({ leadId, ok: true, motivo: null });
      } catch (err) {
        if (!(err instanceof AppError)) throw err;
        // Si Dapta está caído o sin configurar, no tiene sentido seguir con los demás.
        if (err.status === HttpCode.SERVICE_UNAVAILABLE) throw err;
        resultados.push({ leadId, ok: false, motivo: err.message });
      }
    }
    const enviados = resultados.filter((r) => r.ok).length;
    return { enviados, omitidos: resultados.length - enviados, resultados };
  }

  async recibirResultado(body: Record<string, unknown>, secreto: string | undefined): Promise<CalificacionDTO> {
    const esperado = this.d.config.webhookSecret;
    if (!esperado) throw new AppError(HttpCode.SERVICE_UNAVAILABLE, 'El webhook de Dapta no está configurado (falta DAPTA_WEBHOOK_SECRET).');
    if (!secreto || !mismoSecreto(secreto, esperado)) throw new AppError(HttpCode.UNAUTHORIZED, 'Secreto inválido.');

    const r = normalizarResultadoDapta(body);
    const envio = r.referencia
      ? await this.d.repo.findCalificacionPorReferencia(r.referencia)
      : await this.d.repo.findEnvioPendiente(r.leadId!);
    if (!envio || envio.origen !== 'DAPTA') throw new AppError(HttpCode.NOT_FOUND, 'No hay un envío a Dapta con esa referencia.');
    if (r.leadId && r.leadId !== envio.leadId) throw new AppError(HttpCode.BAD_REQUEST, 'La referencia no corresponde a ese lead.');
    if (!r.calidad && !r.sinContacto) {
      throw new AppError(HttpCode.BAD_REQUEST, 'El resultado no trae calificación: manda "calificacion" (alta, media, baja, descartado) o "puntaje" (0 a 100).');
    }

    const ahora = this.d.ahora();
    const guardada = await this.d.repo.guardarResultado(envio.id, {
      estado: r.calidad ? 'CALIFICADO' : 'SIN_CONTACTO',
      calidad: r.calidad,
      puntaje: r.puntaje,
      resumen: r.resumen,
      variables: r.variables,
      llamadaId: r.llamadaId,
      error: null,
      calificadoEn: r.calidad ? ahora : null,
    });
    // Si el agente habló con el lead, el lead respondió: avanza el embudo.
    if (this.d.config.contacta && r.calidad && r.calidad !== 'DESCARTADO') {
      const nota = `Habló con el agente de Dapta${r.resumen ? `: ${r.resumen}` : '.'}`.slice(0, 1000);
      await this.d.contactos.registrarRespuestaExterna(envio.leadId, r.calidad === 'ALTA' ? 'INTERESADO' : 'RESPONDIO', nota);
    }
    return guardada;
  }

  async calificarManual(leadId: number, dto: CalificarManualDTO, usuario: UsuarioSesion): Promise<CalificacionDTO> {
    const lead = await this.lead(leadId);
    if (lead.contactadoPorId && lead.contactadoPorId !== usuario.id && usuario.rol !== 'ADMIN') {
      throw new AppError(HttpCode.CONFLICT, `Este lead lo está trabajando ${lead.contactadoPor?.fullName ?? 'otra persona del equipo'}.`);
    }
    return this.d.repo.crearCalificacionManual({
      leadId, usuarioId: usuario.id, origen: 'MANUAL', estado: 'CALIFICADO', referencia: this.d.nuevaReferencia(),
      calidad: dto.calidad, puntaje: dto.puntaje ?? null, resumen: dto.nota?.trim() || null, variables: null, llamadaId: null,
      error: null, calificadoEn: this.d.ahora(),
    });
  }

  private async lead(id: number): Promise<LeadParaDaptaDTO> {
    const lead = await this.d.repo.findLeadParaDapta(id);
    if (!lead) throw new AppError(HttpCode.NOT_FOUND, 'Lead no encontrado.');
    return lead;
  }
}
