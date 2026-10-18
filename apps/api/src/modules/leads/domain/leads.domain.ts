// Reglas de negocio de los leads: deduplicación entre fuentes, consulta y exportación.
//
// Orden de cruce de un candidato contra lo ya guardado (en el mismo municipio):
//   1. Misma fuente + mismo id externo (re-búsquedas)                → "id_externo"
//   2. Mismo NIT                                                      → "nit"
//   3. Mismo teléfono / correo / dominio, con nombre o ubicación
//      compatibles (evita números compartidos)                       → "telefono" | "email" | "dominio"
//   4. Misma placa entre fuentes distintas, si es la única en el
//      municipio (razón social ≠ nombre comercial)                   → "direccion"
//   5. Nombre parecido + cercanía en el mapa (o, sin coordenadas,
//      2+ palabras distintivas en común y un único candidato)        → "nombre_cercania" | "nombre"

import * as repositorioReal from '../repository/leads.repository';
import { AppError, HttpCode } from '~response/index';
import type { Candidato } from '~types/fuente.types';
import { normalizarDireccion } from '~utils/normalizar';
import type { LeadsDomainInterface } from './leads.interface';
import {
  RADIO_BUSQUEDA_GRADOS,
  aceptaPorNombreSinCoordenadas,
  aceptaPorNombreYDistancia,
  clavesDeCandidato,
  construirLead,
  datosParaGuardar,
  direccionesRepetidasEn,
  distancia,
  fusionar,
  mejorComparacion,
  palabraParaBuscar,
  palabrasDelMunicipio,
  tieneCoordenadas,
} from './leads.cruce';
import type {
  ConteoRegistroDTO,
  ContextoRegistroDTO,
  EstadisticaFuenteDTO,
  FiltrosLeadsDTO,
  LeadDetalleDTO,
  LeadDTO,
  ListadoLeadsDTO,
  ResumenBusquedaLeadsDTO,
} from '../types/leads.types';

export type LeadsRepository = typeof repositorioReal;

interface Coincidencia {
  lead: LeadDTO;
  coincidencia: string;
  detalle?: Record<string, unknown>;
}

const COLUMNAS_CSV = [
  'id', 'nombre', 'razon_social', 'nit', 'municipio', 'departamento', 'cod_mpio', 'direccion', 'lat', 'lon',
  'ciiu', 'categoria_fuente', 'canal_principal', 'telefono_principal', 'telefonos', 'whatsapp', 'emails',
  'sitios_web', 'redes', 'contactable', 'persona_natural', 'fuentes', 'fuente_origen', 'creado_en',
  'contactado', 'contactado_por', 'contactado_en', 'estado_contacto', 'ultimo_contacto_en', 'no_contactar', 'calidad', 'puntaje', 'calificado_en',
] as const;

function celdaCsv(v: unknown): string {
  const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export class LeadsDomain implements LeadsDomainInterface {
  constructor(private readonly repo: LeadsRepository = repositorioReal) {}

  async listar(filtros: FiltrosLeadsDTO): Promise<ListadoLeadsDTO> {
    const [total, leads] = await Promise.all([this.repo.countLeads(filtros), this.repo.findLeads(filtros)]);
    return { total, pagina: filtros.pagina, limite: filtros.limite, leads };
  }

  async obtener(id: number): Promise<LeadDetalleDTO> {
    const lead = await this.repo.findLeadDetalle(id);
    if (!lead) throw new AppError(HttpCode.NOT_FOUND, 'Lead no encontrado.');
    return lead;
  }

  async marcarContactado(id: number, usuarioId: number): Promise<LeadDTO> {
    const asignado = await this.repo.asignarContacto(id, usuarioId);
    const lead = await this.repo.findLead(id);
    if (!lead) throw new AppError(HttpCode.NOT_FOUND, 'Lead no encontrado.');
    // Ya estaba contactado: si fue el mismo usuario no pasa nada; si fue otro, no se reasigna.
    if (!asignado && lead.contactadoPorId !== usuarioId) {
      const quien = lead.contactadoPor?.fullName;
      throw new AppError(HttpCode.CONFLICT, quien ? `Este lead ya lo contactó ${quien}.` : 'Este lead ya fue contactado.', {
        contactadoPor: lead.contactadoPor ?? null,
        contactadoEn: lead.contactadoEn ?? null,
      });
    }
    return lead;
  }

  async exportarCsv(filtros: FiltrosLeadsDTO): Promise<string> {
    const leads = await this.repo.findLeads(filtros);
    const filas = leads.map((l) => {
      const tel = l.telefonos ?? [];
      const principal = tel.find((t) => t.whatsapp) ?? tel.find((t) => t.tipo === 'movil') ?? tel[0];
      const valores: Record<(typeof COLUMNAS_CSV)[number], unknown> = {
        id: l.id,
        nombre: l.nombre,
        razon_social: l.razonSocial,
        nit: l.nit,
        municipio: l.municipio,
        departamento: l.departamento,
        cod_mpio: l.codMpio,
        direccion: l.direccion,
        lat: l.lat,
        lon: l.lon,
        ciiu: l.ciiu,
        categoria_fuente: l.categoriaFuente,
        canal_principal: l.canalPrincipal,
        telefono_principal: principal?.numero,
        telefonos: tel.map((t) => t.numero).join(' | '),
        whatsapp: tel.filter((t) => t.whatsapp).map((t) => t.numero).join(' | '),
        emails: l.emails.join(' | '),
        sitios_web: l.sitiosWeb.join(' | '),
        redes: l.redes.join(' | '),
        contactable: l.contactable ? 'si' : 'no',
        persona_natural: l.esPersonaNatural === null ? '' : l.esPersonaNatural ? 'si' : 'no',
        fuentes: l.fuentes.join(','),
        fuente_origen: l.fuenteOrigen,
        creado_en: l.createdAt,
        contactado: l.contactado ? 'si' : 'no',
        contactado_por: l.contactadoPor?.fullName,
        contactado_en: l.contactadoEn,
        estado_contacto: l.estadoContacto,
        ultimo_contacto_en: l.ultimoContactoEn,
        no_contactar: l.noContactar ? 'si' : 'no',
        calidad: l.calidad,
        puntaje: l.puntaje,
        calificado_en: l.calificadoEn,
      };
      return COLUMNAS_CSV.map((c) => celdaCsv(valores[c])).join(',');
    });
    return `﻿${COLUMNAS_CSV.join(',')}\n${filas.join('\n')}${filas.length ? '\n' : ''}`;
  }

  async registrarCandidatos(candidatos: Candidato[], ctx: ContextoRegistroDTO): Promise<ConteoRegistroDTO> {
    const conteo: ConteoRegistroDTO = { registros: candidatos.length, nuevos: 0, enriquecidos: 0, sinCambios: 0, omitidos: 0 };
    const ignorar = palabrasDelMunicipio(ctx.municipio);
    const repetidas = direccionesRepetidasEn(candidatos);

    // Secuencial a propósito: cada candidato debe ver lo que guardó el anterior.
    for (const cand of candidatos) {
      if (!cand.nombre && !cand.razonSocial) {
        conteo.omitidos += 1;
        continue;
      }
      const hallado = await this.buscarCoincidencia(cand, ignorar, repetidas);
      let leadId: number;
      let resultado: 'nuevo' | 'enriquecido' | 'sin_cambios';
      if (!hallado) {
        const creado = await this.repo.createLead(construirLead(cand, ctx));
        leadId = creado.id;
        resultado = 'nuevo';
        conteo.nuevos += 1;
      } else {
        const { lead, cambio } = fusionar(hallado.lead, cand, ctx.categoria);
        leadId = lead.id;
        if (cambio) {
          const { id: _id, createdAt: _c, updatedAt: _u, ...datos } = lead;
          await this.repo.updateLead(lead.id, datos);
          resultado = 'enriquecido';
          conteo.enriquecidos += 1;
        } else {
          resultado = 'sin_cambios';
          conteo.sinCambios += 1;
        }
      }
      await this.repo.createClaves(leadId, clavesDeCandidato(cand));
      await this.repo.upsertAparicion({
        leadId,
        fuente: cand.fuente,
        idExterno: cand.idExterno,
        coincidencia: hallado ? hallado.coincidencia : 'nuevo',
        datos: datosParaGuardar(cand),
        busquedaId: ctx.busquedaId,
      });
      await this.repo.createBusquedaLead(ctx.busquedaId, leadId, cand.fuente, resultado);
    }
    return conteo;
  }

  async resumenDeBusqueda(busquedaId: number): Promise<ResumenBusquedaLeadsDTO> {
    const [leads, nuevos, contactables, enVariasFuentes] = await Promise.all([
      this.repo.countLeads({ busquedaId }),
      this.repo.countLeadsNuevosDeBusqueda(busquedaId),
      this.repo.countLeads({ busquedaId, contactable: true }),
      this.repo.countLeads({ busquedaId, enAmbas: true }),
    ]);
    return { leads, nuevos, contactables, enVariasFuentes };
  }

  async estadisticas(): Promise<EstadisticaFuenteDTO[]> {
    return this.repo.findEstadisticasPorFuente();
  }

  /** Busca un lead existente que sea el mismo negocio que el candidato. */
  async buscarCoincidencia(cand: Candidato, ignorar?: Set<string>, direccionesRepetidas?: Set<string>): Promise<Coincidencia | null> {
    // 1. Re-búsqueda
    const previo = await this.repo.findLeadByAparicion(cand.fuente, cand.idExterno);
    if (previo) return { lead: previo, coincidencia: 'id_externo' };

    // 2 y 3. Claves fuertes
    for (const { tipo, valor } of clavesDeCandidato(cand)) {
      const lead = await this.repo.findLeadByClave(tipo, valor);
      if (!lead) continue;
      if (tipo === 'nit') return { lead, coincidencia: 'nit' };
      if (cand.nit && lead.nit && cand.nit !== lead.nit) continue;
      const cmp = mejorComparacion(cand, lead, ignorar);
      const metros = distancia(cand, lead);
      if (cmp.comunes >= 1 || metros <= 200) {
        return { lead, coincidencia: tipo, detalle: { puntaje: cmp.puntaje, metros: Number.isFinite(metros) ? Math.round(metros) : null } };
      }
    }

    // 4. Misma placa entre fuentes distintas
    const placa = normalizarDireccion(cand.direccion);
    if (placa && !direccionesRepetidas?.has(`${cand.fuente}|${placa}`)) {
      const otros = await this.repo.findLeadsPorDireccion(cand.codMpio, placa);
      const deOtraFuente = otros.filter((l) => !l.fuentes.includes(cand.fuente));
      if (otros.length === 1 && deOtraFuente.length === 1) {
        const lead = deOtraFuente[0];
        const metros = distancia(cand, lead);
        const nitCompatible = !(cand.nit && lead.nit && cand.nit !== lead.nit);
        if (nitCompatible && (!Number.isFinite(metros) || metros <= 150)) {
          return { lead, coincidencia: 'direccion', detalle: { placa } };
        }
      }
    }

    // 5. Nombre (+ distancia si hay coordenadas)
    return tieneCoordenadas(cand) ? this.porNombreYDistancia(cand, ignorar) : this.porNombreSinCoordenadas(cand, ignorar);
  }

  private puedeFusionarPorNombre(cand: Candidato, lead: LeadDTO): boolean {
    if (cand.nit && lead.nit && cand.nit !== lead.nit) return false;
    if (!lead.fuentes.includes(cand.fuente)) return true;
    // Dentro de una misma fuente, solo OSM tiene duplicados (el local como punto y como edificio).
    return cand.fuente === 'osm';
  }

  private async porNombreYDistancia(cand: Candidato, ignorar?: Set<string>): Promise<Coincidencia | null> {
    const cercanos = await this.repo.findLeadsCercanos(cand.codMpio, cand.lat!, cand.lon!, RADIO_BUSQUEDA_GRADOS);
    let mejor: { lead: LeadDTO; puntaje: number; metros: number } | null = null;
    for (const lead of cercanos) {
      if (!this.puedeFusionarPorNombre(cand, lead)) continue;
      const cmp = mejorComparacion(cand, lead, ignorar);
      const metros = distancia(cand, lead);
      const acepta = lead.fuentes.includes(cand.fuente) ? cmp.puntaje >= 0.9 && metros <= 50 : aceptaPorNombreYDistancia(cmp, metros);
      if (!acepta) continue;
      if (!mejor || cmp.puntaje > mejor.puntaje || (cmp.puntaje === mejor.puntaje && metros < mejor.metros)) {
        mejor = { lead, puntaje: cmp.puntaje, metros };
      }
    }
    if (!mejor) return null;
    return {
      lead: mejor.lead,
      coincidencia: 'nombre_cercania',
      detalle: { puntaje: Number(mejor.puntaje.toFixed(2)), metros: Math.round(mejor.metros) },
    };
  }

  private async porNombreSinCoordenadas(cand: Candidato, ignorar?: Set<string>): Promise<Coincidencia | null> {
    const palabra = palabraParaBuscar(cand, ignorar);
    if (!palabra) return null;
    const posibles = await this.repo.findLeadsPorPalabra(cand.codMpio, palabra);
    const aceptados = posibles.filter(
      (l) => !l.fuentes.includes(cand.fuente) && this.puedeFusionarPorNombre(cand, l) && aceptaPorNombreSinCoordenadas(mejorComparacion(cand, l, ignorar))
    );
    // Si hay más de uno igual de parecido, no se puede saber cuál es.
    if (aceptados.length !== 1) return null;
    return { lead: aceptados[0], coincidencia: 'nombre', detalle: { palabra } };
  }
}
