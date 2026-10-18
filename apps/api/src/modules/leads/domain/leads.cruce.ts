// Reglas de cruce entre fuentes (funciones puras, sin acceso a datos).

import type { Candidato, Municipio, Telefono } from '~types/fuente.types';
import {
  compararNombres,
  distanciaMetros,
  normalizarDireccion,
  normalizarDominio,
  normalizarNombreEmpresa,
  normalizarTexto,
  palabrasDistintivas,
  type ComparacionNombres,
} from '~utils/normalizar';
import type { CanalPrincipal, ClaveDTO, CreateLeadDTO, LeadDTO } from '../types/leads.types';

/** ~330 m alrededor del candidato para buscar leads cercanos. */
export const RADIO_BUSQUEDA_GRADOS = 0.003;

/**
 * Claves fuertes del candidato. Van con el código del municipio porque los
 * leads son por ciudad: la misma empresa en dos ciudades son dos leads.
 */
export function clavesDeCandidato(c: Candidato): ClaveDTO[] {
  const claves: ClaveDTO[] = [];
  const k = (v: string) => `${c.codMpio}|${v}`;
  if (c.nit) claves.push({ tipo: 'nit', valor: k(c.nit) });
  for (const t of c.telefonos) claves.push({ tipo: 'telefono', valor: k(t.numero) });
  for (const e of c.emails) claves.push({ tipo: 'email', valor: k(e) });
  for (const w of c.sitiosWeb) {
    const d = normalizarDominio(w);
    if (d) claves.push({ tipo: 'dominio', valor: k(d) });
  }
  return claves;
}

function nombresDe(x: { nombre?: string | null; nombreComercial?: string | null; razonSocial?: string | null }): string[] {
  return [x.nombre, x.nombreComercial, x.razonSocial].filter((n): n is string => Boolean(n));
}

export function mejorComparacion(cand: Candidato, lead: LeadDTO, ignorar?: Set<string>): ComparacionNombres {
  let mejor: ComparacionNombres = { puntaje: 0, comunes: 0, minimo: 0 };
  for (const a of nombresDe(cand)) {
    for (const b of nombresDe(lead)) {
      const r = compararNombres(a, b, ignorar);
      if (r.puntaje > mejor.puntaje || (r.puntaje === mejor.puntaje && r.comunes > mejor.comunes)) mejor = r;
    }
  }
  return mejor;
}

/**
 * Umbrales calibrados con datos reales del DANE y OSM (las coordenadas del
 * DANE salen de geocodificar direcciones y pueden estar corridas):
 *   2+ palabras distintivas en común (puntaje ≥ 0.9) .... hasta 300 m
 *   1 palabra distintiva idéntica ("Oasis") ............. hasta 120 m
 *   puntaje ≥ 0.75 ...................................... hasta 80 m
 *   puntaje ≥ 0.6 ....................................... hasta 30 m
 */
export function aceptaPorNombreYDistancia(cmp: ComparacionNombres, metros: number): boolean {
  if (cmp.comunes >= 2 && cmp.puntaje >= 0.9) return metros <= 300;
  if (cmp.comunes === 1 && cmp.puntaje === 1) return metros <= 120;
  if (cmp.puntaje >= 0.75) return metros <= 80;
  if (cmp.puntaje >= 0.6) return metros <= 30;
  return false;
}

/** Sin coordenadas solo se acepta un nombre con 2+ palabras distintivas en común. */
export function aceptaPorNombreSinCoordenadas(cmp: ComparacionNombres): boolean {
  return cmp.comunes >= 2 && cmp.puntaje >= 0.9;
}

/** La palabra más larga y distintiva del nombre, para buscar candidatos en la base. */
export function palabraParaBuscar(cand: Candidato, ignorar?: Set<string>): string | null {
  const palabras = nombresDe(cand).flatMap((n) => [...palabrasDistintivas(n, ignorar)]);
  const ordenadas = palabras.filter((p) => p.length >= 4 && !/^\d+$/.test(p)).sort((a, b) => b.length - a.length);
  return ordenadas[0] ?? null;
}

export function tieneCoordenadas(x: { lat: number | null; lon: number | null }): boolean {
  return typeof x.lat === 'number' && Number.isFinite(x.lat) && typeof x.lon === 'number' && Number.isFinite(x.lon);
}

export function distancia(a: { lat: number | null; lon: number | null }, b: { lat: number | null; lon: number | null }): number {
  return distanciaMetros(a, b);
}

export function nombresNormalizados(x: { nombre?: string | null; nombreComercial?: string | null; razonSocial?: string | null }): string {
  return [...new Set(nombresDe(x).map(normalizarTexto))].join(' | ');
}

export function canalPrincipal(lead: Pick<LeadDTO, 'telefonos' | 'emails' | 'sitiosWeb' | 'redes'>): CanalPrincipal | null {
  const tels = lead.telefonos ?? [];
  if (tels.some((t) => t.whatsapp)) return 'whatsapp';
  if (tels.some((t) => t.tipo === 'movil')) return 'movil';
  if (tels.length) return 'fijo';
  if (lead.emails?.length) return 'email';
  if (lead.sitiosWeb?.length) return 'web';
  if (lead.redes?.length) return 'red_social';
  return null;
}

export function construirLead(cand: Candidato, ctx: { municipio: Municipio; categoria: string | null; busquedaId: number }): CreateLeadDTO {
  const base = {
    nombre: (cand.nombre ?? cand.razonSocial ?? '(sin nombre)').trim(),
    nombreComercial: cand.nombreComercial,
    razonSocial: cand.razonSocial,
    nombresNorm: nombresNormalizados(cand),
    nit: cand.nit,
    codMpio: cand.codMpio || ctx.municipio.codigo,
    municipio: ctx.municipio.nombre,
    departamento: ctx.municipio.departamento,
    direccion: cand.direccion,
    direccionNorm: normalizarDireccion(cand.direccion),
    lat: cand.lat,
    lon: cand.lon,
    ciiu: cand.ciiu,
    categoriaFuente: cand.categoriaFuente,
    categorias: ctx.categoria ? [ctx.categoria] : [],
    telefonos: cand.telefonos,
    emails: cand.emails,
    sitiosWeb: cand.sitiosWeb,
    redes: cand.redes,
    esPersonaNatural: cand.esPersonaNatural,
    fuentes: [cand.fuente],
    numFuentes: 1,
    fuenteOrigen: cand.fuente,
    busquedaOrigenId: ctx.busquedaId,
  };
  const canal = canalPrincipal(base);
  return { ...base, canalPrincipal: canal, contactable: Boolean(canal) };
}

function unir<T>(lista: T[], nuevos: T[], clave: (x: T) => string = (x) => String(x)): { lista: T[]; cambio: boolean } {
  const vistos = new Map(lista.map((x) => [clave(x), x]));
  let cambio = false;
  for (const n of nuevos) {
    const k = clave(n);
    const existente = vistos.get(k) as unknown as Telefono | undefined;
    if (!existente) {
      vistos.set(k, n);
      cambio = true;
    } else if ((n as unknown as Telefono).whatsapp && !existente.whatsapp) {
      vistos.set(k, { ...existente, whatsapp: true } as unknown as T);
      cambio = true;
    }
  }
  return { lista: [...vistos.values()], cambio };
}

/** Completa un lead existente con lo que trae el candidato. Nunca borra datos. */
export function fusionar(lead: LeadDTO, cand: Candidato, categoria: string | null): { lead: LeadDTO; cambio: boolean } {
  const l: LeadDTO = { ...lead };
  let cambio = false;
  const llenar = <K extends keyof LeadDTO>(campo: K, valor: LeadDTO[K] | null | undefined) => {
    if (valor !== null && valor !== undefined && valor !== '' && (l[campo] === null || l[campo] === undefined || l[campo] === '')) {
      l[campo] = valor;
      cambio = true;
    }
  };

  llenar('nit', cand.nit);
  llenar('razonSocial', cand.razonSocial);
  llenar('nombreComercial', cand.nombreComercial);
  llenar('direccion', cand.direccion);
  llenar('direccionNorm', normalizarDireccion(l.direccion));
  llenar('ciiu', cand.ciiu);
  llenar('categoriaFuente', cand.categoriaFuente);

  // Si alguna fuente confirma que es empresa, queda como empresa.
  if (cand.esPersonaNatural === false && l.esPersonaNatural !== false) {
    l.esPersonaNatural = false;
    cambio = true;
  } else if (l.esPersonaNatural === null && cand.esPersonaNatural === true) {
    l.esPersonaNatural = true;
    cambio = true;
  }

  // El nombre comercial (como lo conoce la gente) le gana a la razón social.
  const preferido = l.nombreComercial || l.razonSocial || l.nombre;
  if (preferido && preferido !== l.nombre) {
    l.nombre = preferido;
    cambio = true;
  }
  const nombres = [...new Set([...l.nombresNorm.split(' | '), ...nombresNormalizados(cand).split(' | ')].filter(Boolean))].join(' | ');
  if (nombres !== l.nombresNorm) {
    l.nombresNorm = nombres;
    cambio = true;
  }

  // Coordenadas: las de OSM son del local; las del DANE salen de geocodificar.
  if (cand.fuente === 'osm' && tieneCoordenadas(cand) && (!l.fuentes.includes('osm') || !tieneCoordenadas(l))) {
    if (l.lat !== cand.lat || l.lon !== cand.lon) {
      l.lat = cand.lat;
      l.lon = cand.lon;
      cambio = true;
    }
  } else if (!tieneCoordenadas(l) && tieneCoordenadas(cand)) {
    l.lat = cand.lat;
    l.lon = cand.lon;
    cambio = true;
  }

  const listas: [keyof LeadDTO, unknown[], ((x: never) => string) | undefined][] = [
    ['telefonos', cand.telefonos, ((t: Telefono) => t.numero) as (x: never) => string],
    ['emails', cand.emails, undefined],
    ['sitiosWeb', cand.sitiosWeb, undefined],
    ['redes', cand.redes, undefined],
    ['fuentes', [cand.fuente], undefined],
    ['categorias', categoria ? [categoria] : [], undefined],
  ];
  for (const [campo, nuevos, clave] of listas) {
    const r = unir((l[campo] as unknown[]) ?? [], nuevos, clave as ((x: unknown) => string) | undefined);
    (l as unknown as Record<string, unknown>)[campo] = r.lista;
    cambio = cambio || r.cambio;
  }
  l.numFuentes = l.fuentes.length;

  const canal = canalPrincipal(l);
  if (canal !== l.canalPrincipal) {
    l.canalPrincipal = canal;
    cambio = true;
  }
  l.contactable = Boolean(canal);
  return { lead: l, cambio };
}

export function palabrasDelMunicipio(municipio: Municipio): Set<string> {
  return new Set(normalizarNombreEmpresa(municipio.nombre).split(' ').filter((p) => p.length > 2));
}

/** "fuente|placa" que aparecen más de una vez en un lote (centros comerciales). */
export function direccionesRepetidasEn(candidatos: Candidato[]): Set<string> {
  const conteo = new Map<string, number>();
  for (const c of candidatos) {
    const placa = normalizarDireccion(c.direccion);
    if (!placa) continue;
    const k = `${c.fuente}|${placa}`;
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }
  return new Set([...conteo].filter(([, n]) => n > 1).map(([k]) => k));
}

/** Lo que se guarda del registro original en `apariciones.datos`. */
export function datosParaGuardar(c: Candidato): unknown {
  return c.crudo ?? null;
}
