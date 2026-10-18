// Orquesta una búsqueda: ciudad → municipio DIVIPOLA → fuentes en paralelo →
// deduplicación (módulo leads) → resumen.
// Para que responda rápido: cada fuente tiene un tope de espera, sus resultados
// se guardan en caché unas horas, y la búsqueda puede correr en segundo plano
// (iniciar) mientras el cliente consulta GET /busquedas/:id.

import * as repositorioReal from '../repository/busquedas.repository';
import { environment } from '~config/environment';
import { logger } from '~config/logger';
import { AppError, HttpCode } from '~response/index';
import { crearFuentes } from '~services/fuentes';
import type { FiltroFuente, FiltrosBusqueda, FuenteLeads, Municipio, NombreFuente, ResultadoFuente } from '~types/fuente.types';
import { CacheTtl, conLimiteDeTiempo } from '~utils/cacheTtl';
import { ColaSerial } from '~utils/colaSerial';
import { resolverMunicipio } from '~utils/divipola';
import { LeadsDomain } from 'modules/leads/domain/leads.domain';
import type { LeadsDomainInterface } from 'modules/leads/domain/leads.interface';
import { resolverFiltros } from './busquedas.filtros';
import type { BusquedasDomainInterface } from './busquedas.interface';
import type {
  BusquedaDTO,
  BusquedaFuenteDTO,
  CrearBusquedaDTO,
  EstadoBusqueda,
  InicioBusquedaDTO,
  ResultadoBusquedaDTO,
  ResumenBusquedaDTO,
} from '../types/busquedas.types';

export type BusquedasRepository = typeof repositorioReal;

/**
 * Orden en que se guardan los resultados. El DANE va primero (ancla de NIT),
 * luego los registros con contacto y NIT, y al final OSM, que cruza por
 * cercanía y nombre contra todo lo anterior.
 */
export const ORDEN_PROCESO: NombreFuente[] = ['dane', 'rnt', 'reps', 'secop', 'osm'];

export interface DependenciasBusquedas {
  repo?: BusquedasRepository;
  leads?: LeadsDomainInterface;
  fuentes?: FuenteLeads[];
  cola?: ColaSerial;
  maxEnCola?: number;
  /** Caché de resultados por fuente. Por defecto, según CACHE_FUENTES_MINUTOS. */
  cache?: CacheTtl<ResultadoFuente>;
  /** Tope de espera por fuente (ms). Por defecto, FUENTE_MAX_MS. */
  fuenteMaxMs?: number;
}

interface PlanBusqueda {
  dto: CrearBusquedaDTO;
  municipio: Municipio;
  filtros: FiltrosBusqueda;
  pedidas: NombreFuente[];
}

/** Clave de caché: misma fuente, mismo municipio y mismos filtros → mismo resultado. */
export function claveCache(nombre: NombreFuente, municipio: Municipio, filtro: FiltroFuente, incluirPersonasNaturales: boolean): string {
  return [nombre, municipio.codigo, [...filtro.valores].sort().join(','), incluirPersonasNaturales ? 'pn' : ''].join('|');
}

export class BusquedasDomain implements BusquedasDomainInterface {
  private readonly repo: BusquedasRepository;
  private readonly leads: LeadsDomainInterface;
  private readonly fuentes: Map<NombreFuente, FuenteLeads>;
  private readonly cola: ColaSerial;
  private readonly maxEnCola: number;
  private readonly cache: CacheTtl<ResultadoFuente>;
  private readonly fuenteMaxMs: number;

  constructor(deps: DependenciasBusquedas = {}) {
    this.repo = deps.repo ?? repositorioReal;
    this.leads = deps.leads ?? new LeadsDomain();
    this.fuentes = new Map((deps.fuentes ?? crearFuentes(environment)).map((f) => [f.nombre, f]));
    this.cola = deps.cola ?? new ColaSerial();
    this.maxEnCola = deps.maxEnCola ?? 5;
    this.cache = deps.cache ?? new CacheTtl<ResultadoFuente>(environment.cache.ttlMs, environment.cache.maxEntradas);
    this.fuenteMaxMs = deps.fuenteMaxMs ?? environment.fuenteMaxMs;
  }

  /** Busca y espera el resultado completo (puede tardar si una fuente está lenta). */
  async crear(dto: CrearBusquedaDTO): Promise<ResultadoBusquedaDTO> {
    const plan = this.preparar(dto);
    const busqueda = await this.registrar(plan);
    return this.cola.ejecutar(() => this.procesar(plan, busqueda.id));
  }

  /**
   * Valida, registra la búsqueda y la deja corriendo en segundo plano. Responde
   * de inmediato con el id; el avance se consulta con obtener(id) hasta que el
   * estado deje de ser "en_curso".
   */
  async iniciar(dto: CrearBusquedaDTO): Promise<InicioBusquedaDTO> {
    const plan = this.preparar(dto);
    const busqueda = await this.registrar(plan);
    const enCola = this.cola.enEspera;
    this.cola.ejecutar(() => this.procesar(plan, busqueda.id)).catch(async (error: unknown) => {
      if (error instanceof AppError) return; // ya quedó guardada como fallida
      logger.error({ err: (error as Error)?.message, busquedaId: busqueda.id }, 'La búsqueda en segundo plano falló');
      await this.repo
        .updateBusqueda(busqueda.id, { estado: 'fallida', resumen: resumenVacio({}), terminadoEn: new Date() })
        .catch(() => undefined);
    });
    return {
      busquedaId: busqueda.id,
      estado: 'en_curso',
      enCola,
      municipio: { codigo: plan.municipio.codigo, nombre: plan.municipio.nombre, departamento: plan.municipio.departamento },
      filtros: plan.filtros,
    };
  }

  private preparar(dto: CrearBusquedaDTO): PlanBusqueda {
    const r = resolverMunicipio({ ciudad: dto.ciudad, departamento: dto.departamento, codigo: dto.codigo });
    if ('error' in r) throw new AppError(HttpCode.NOT_FOUND, r.error);
    if ('candidatos' in r) {
      throw new AppError(
        HttpCode.CONFLICT,
        `Hay ${r.candidatos.length} municipios llamados "${dto.ciudad}". Agrega "departamento" o usa "codigo".`,
        { candidatos: r.candidatos }
      );
    }
    const municipio = r.municipio;
    const filtros = resolverFiltros(dto);

    const pedidas = dto.fuentes?.length ? [...new Set(dto.fuentes)] : [...this.fuentes.keys()];
    const desconocidas = pedidas.filter((f) => !this.fuentes.has(f));
    if (desconocidas.length) {
      throw new AppError(HttpCode.BAD_REQUEST, `Fuente no disponible: ${desconocidas.join(', ')}.`);
    }
    if (this.cola.enEspera >= this.maxEnCola) {
      throw new AppError(HttpCode.TOO_MANY_REQUESTS, 'Hay demasiadas búsquedas en cola. Intenta en un momento.');
    }
    return { dto, municipio, filtros, pedidas };
  }

  private registrar({ dto, municipio, filtros, pedidas }: PlanBusqueda) {
    return this.repo.createBusqueda({
      ciudadTexto: dto.ciudad ?? null,
      departamentoTexto: dto.departamento ?? null,
      codMpio: municipio.codigo,
      municipio: municipio.nombre,
      departamento: municipio.departamento,
      categoria: filtros.categoria,
      filtros,
      fuentesPedidas: pedidas,
    });
  }

  /** Pide a una fuente, usando la caché si ya se consultó lo mismo hace poco. */
  private async consultarFuente(nombre: NombreFuente, municipio: Municipio, filtro: FiltroFuente, filtros: FiltrosBusqueda, refrescar: boolean): Promise<ResultadoFuente> {
    const clave = claveCache(nombre, municipio, filtro, filtros.incluirPersonasNaturales);
    const guardado = refrescar ? undefined : this.cache.get(clave);
    if (guardado) {
      const copia = structuredClone(guardado);
      return { ...copia, meta: { ...(copia.meta ?? {}), cache: true } };
    }
    const res = await conLimiteDeTiempo(
      this.fuentes.get(nombre)!.buscar(municipio, filtro, { incluirPersonasNaturales: filtros.incluirPersonasNaturales }),
      this.fuenteMaxMs,
      `La fuente no respondió en ${Math.round(this.fuenteMaxMs / 1000)} s.`
    );
    this.cache.set(clave, structuredClone(res));
    return res;
  }

  private async procesar({ dto, municipio, filtros, pedidas }: PlanBusqueda, busquedaId: number): Promise<ResultadoBusquedaDTO> {
    const busqueda = { id: busquedaId };

    // Las fuentes se consultan en paralelo; si una falla, las demás igual se guardan.
    const respuestas = await Promise.all(
      pedidas.map(async (nombre) => {
        const filtro = filtros.porFuente[nombre];
        if (!filtro.aplica) return { nombre, omitida: true as const, ms: 0 };
        const inicio = Date.now();
        try {
          const res = await this.consultarFuente(nombre, municipio, filtro, filtros, dto.refrescar === true);
          return { nombre, res, ms: Date.now() - inicio };
        } catch (error) {
          logger.warn({ fuente: nombre, err: (error as Error).message }, 'La fuente falló');
          return { nombre, error: error as Error, ms: Date.now() - inicio };
        }
      })
    );

    const porFuente: Partial<Record<NombreFuente, BusquedaFuenteDTO>> = {};
    const ordenadas = [...respuestas].sort((a, b) => ORDEN_PROCESO.indexOf(a.nombre) - ORDEN_PROCESO.indexOf(b.nombre));
    for (const r of ordenadas) {
      let resultado: BusquedaFuenteDTO;
      if ('omitida' in r) {
        resultado = vacio(r.nombre, 'omitida', { motivo: 'La categoría no tiene equivalente en esta fuente' });
      } else if ('error' in r && r.error) {
        resultado = { ...vacio(r.nombre, 'error'), error: r.error.message, duracionMs: r.ms };
      } else {
        const conteo = await this.leads.registrarCandidatos(r.res!.candidatos, {
          municipio,
          categoria: filtros.categoria,
          busquedaId: busqueda.id,
        });
        resultado = { fuente: r.nombre, estado: 'ok', ...conteo, duracionMs: r.ms, error: null, meta: r.res!.meta ?? null };
      }
      porFuente[r.nombre] = resultado;
      await this.repo.upsertBusquedaFuente(busqueda.id, resultado);
    }

    const consultadas = Object.values(porFuente).filter(
      (f): f is BusquedaFuenteDTO => f !== undefined && f.estado !== 'omitida',
    );
    const fallidas = consultadas.filter((f) => f.estado === 'error').length;
    const estado: EstadoBusqueda = fallidas === 0 ? 'completa' : fallidas === consultadas.length ? 'fallida' : 'parcial';
    const resumen: ResumenBusquedaDTO = { ...(await this.leads.resumenDeBusqueda(busqueda.id)), porFuente };
    await this.repo.updateBusqueda(busqueda.id, { estado, resumen, terminadoEn: new Date() });

    if (estado === 'fallida') {
      throw new AppError(HttpCode.BAD_GATEWAY, 'Ninguna fuente respondió. Intenta de nuevo en unos minutos.', {
        busquedaId: busqueda.id,
        porFuente,
      });
    }

    const listado = await this.leads.listar({ busquedaId: busqueda.id, limite: dto.limiteLeads ?? 200, pagina: 1 });
    return {
      busquedaId: busqueda.id,
      estado,
      municipio: { codigo: municipio.codigo, nombre: municipio.nombre, departamento: municipio.departamento },
      filtros,
      resumen,
      leadsTotal: listado.total,
      leads: listado.leads,
    };
  }

  async listar(limite: number): Promise<BusquedaDTO[]> {
    return this.repo.findBusquedas(limite);
  }

  async obtener(id: number): Promise<BusquedaDTO> {
    const b = await this.repo.findBusquedaById(id);
    if (!b) throw new AppError(HttpCode.NOT_FOUND, 'Búsqueda no encontrada.');
    return b;
  }
}

function resumenVacio(porFuente: ResumenBusquedaDTO['porFuente']): ResumenBusquedaDTO {
  return { leads: 0, nuevos: 0, contactables: 0, enVariasFuentes: 0, porFuente };
}

function vacio(fuente: NombreFuente, estado: BusquedaFuenteDTO['estado'], meta: Record<string, unknown> | null = null): BusquedaFuenteDTO {
  return { fuente, estado, registros: 0, nuevos: 0, enriquecidos: 0, sinCambios: 0, omitidos: 0, duracionMs: null, error: null, meta };
}
