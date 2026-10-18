// Fuente OpenStreetMap vía Overpass API.
// 1) Ubica el límite del municipio por su código DIVIPOLA (etiqueta "divipola"
//    de las relaciones administrativas de Colombia en OSM).
// 2) Si el municipio no tiene esa etiqueta, busca en un radio alrededor del centro.
// Datos © colaboradores de OpenStreetMap, licencia ODbL.

import type { Candidato, FiltroFuente, FuenteLeads, Municipio, Telefono } from '~types/fuente.types';
import { parsearEtiquetaOsm } from '~config/catalogo/categorias';
import { extraerHost, normalizarDominio, normalizarEmails, normalizarTelefonos } from '~utils/normalizar';
import { ErrorFuente, esperar, pedirJson, type FetchLike } from './http';

export const OVERPASS_POR_DEFECTO = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

interface ElementoOsm {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function filtroOverpass(etiqueta: string): string {
  const t = parsearEtiquetaOsm(etiqueta);
  if (!t) throw new ErrorFuente(`Etiqueta OSM inválida: ${etiqueta}`);
  return t.valor === undefined ? `["${t.clave}"]` : `["${t.clave}"="${t.valor}"]`;
}

export function consultaPorDivipola(codMpio: string, etiquetas: string[], timeoutS: number): string {
  if (!/^\d{5}$/.test(codMpio)) throw new ErrorFuente('Código de municipio inválido.');
  const filtros = etiquetas.map(filtroOverpass);
  return [
    `[out:json][timeout:${Math.round(timeoutS)}];`,
    `rel["boundary"="administrative"]["divipola"="${codMpio}"]->.limite;`,
    '.limite out ids;',
    '.limite map_to_area->.zona;',
    '(',
    ...filtros.map((f) => `  nwr(area.zona)${f}["name"];`),
    ');',
    'out center tags;',
  ].join('\n');
}

export function consultaPorRadio(lat: number, lon: number, radioM: number, etiquetas: string[], timeoutS: number): string {
  if (![lat, lon, radioM].every(Number.isFinite)) throw new ErrorFuente('Coordenadas inválidas.');
  const filtros = etiquetas.map(filtroOverpass);
  const ambito = `(around:${Math.round(radioM)},${lat.toFixed(6)},${lon.toFixed(6)})`;
  return [
    `[out:json][timeout:${Math.round(timeoutS)}];`,
    '(',
    ...filtros.map((f) => `  nwr${ambito}${f}["name"];`),
    ');',
    'out center tags;',
  ].join('\n');
}

const CLAVES_CATEGORIA = ['shop', 'amenity', 'office', 'craft', 'tourism', 'healthcare', 'leisure'];

export function osmACandidato(el: ElementoOsm, municipio: Municipio): Candidato {
  const t = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat ?? null;
  const lon = el.lon ?? el.center?.lon ?? null;

  const telefonos: Telefono[] = normalizarTelefonos(
    [t.phone, t['contact:phone'], t.mobile, t['contact:mobile'], t['phone:mobile']],
    municipio.codigoDepartamento
  );
  for (const w of normalizarTelefonos([t['contact:whatsapp'], t.whatsapp], municipio.codigoDepartamento)) {
    const existente = telefonos.find((x) => x.numero === w.numero);
    if (existente) existente.whatsapp = true;
    else telefonos.push({ ...w, whatsapp: true });
  }

  const sitiosWeb: string[] = [];
  const redes: string[] = [];
  for (const url of [t.website, t['contact:website'], t.url].filter(Boolean)) {
    if (!extraerHost(url)) continue;
    if (normalizarDominio(url)) sitiosWeb.push(url.trim());
    else redes.push(url.trim());
  }
  for (const k of ['contact:facebook', 'facebook', 'contact:instagram', 'instagram', 'contact:tiktok']) {
    if (t[k]) redes.push(t[k].trim());
  }

  const calle = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' # ');
  const claveCategoria = CLAVES_CATEGORIA.find((c) => t[c]);

  return {
    fuente: 'osm',
    idExterno: `${el.type}/${el.id}`,
    nombre: t.name ?? null,
    razonSocial: null,
    nombreComercial: t.name ?? null,
    nit: null,
    codMpio: municipio.codigo,
    direccion: t['addr:full'] || calle || null,
    lat,
    lon,
    ciiu: null,
    categoriaFuente: claveCategoria ? `${claveCategoria}=${t[claveCategoria]}` : null,
    telefonos,
    emails: normalizarEmails([t.email, t['contact:email']]),
    sitiosWeb: [...new Set(sitiosWeb)],
    redes: [...new Set(redes)],
    esPersonaNatural: null,
    crudo: { type: el.type, id: el.id, lat, lon, tags: t },
  };
}

export function crearFuenteOsm(
  o: {
    endpoints?: string[];
    /** Espera máxima por cada servidor de Overpass */
    timeoutMs?: number;
    /** Espera máxima total de la fuente, sumando reintentos y la búsqueda por radio */
    presupuestoMs?: number;
    radioRespaldoM?: number;
    userAgent?: string;
    maxBytes?: number;
    pausaReintentoMs?: number;
    fetchImpl?: FetchLike;
    ahora?: () => number;
  } = {}
): FuenteLeads {
  const endpoints = o.endpoints ?? OVERPASS_POR_DEFECTO;
  const timeoutMs = o.timeoutMs ?? 60000;
  const presupuestoMs = o.presupuestoMs ?? 100000;
  const radioRespaldoM = o.radioRespaldoM ?? 4000;
  const pausa = o.pausaReintentoMs ?? 1000;
  const ahora = o.ahora ?? Date.now;
  /** Por debajo de esto no vale la pena lanzar otra consulta a Overpass */
  const MINIMO_UTIL_MS = 10000;

  /**
   * Prueba los servidores en orden hasta que uno responda o se acabe el tiempo.
   * La consulta se arma en cada intento para que el [timeout:] que se le pide a
   * Overpass nunca supere lo que queda del presupuesto.
   */
  async function ejecutar(armar: (timeoutS: number) => string, vence: number): Promise<{ elements?: ElementoOsm[] }> {
    let ultimoError: ErrorFuente | undefined;
    for (let i = 0; i < endpoints.length; i += 1) {
      const restante = vence - ahora();
      if (restante < MINIMO_UTIL_MS) break;
      const espera = Math.min(timeoutMs, restante);
      const timeoutS = Math.max(5, Math.floor(espera / 1000) - 5);
      try {
        return await pedirJson(endpoints[i], {
          method: 'POST',
          body: new URLSearchParams({ data: armar(timeoutS) }).toString(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'User-Agent': o.userAgent ?? 'leads-colombia/2.0',
          },
          timeoutMs: espera,
          maxBytes: o.maxBytes ?? 80e6,
          fetchImpl: o.fetchImpl,
        });
      } catch (err) {
        ultimoError = err as ErrorFuente;
        if (!ultimoError.reintentable) throw err;
        if (i < endpoints.length - 1) {
          const pausaMs = Math.min(ultimoError.retryAfterMs ?? pausa, 30000);
          if (vence - ahora() - pausaMs < MINIMO_UTIL_MS) break;
          await esperar(pausaMs);
        }
      }
    }
    const motivo = ultimoError?.message ?? `se agotó el tiempo total de ${Math.round(presupuestoMs / 1000)} s`;
    throw new ErrorFuente(`Overpass no respondió (${motivo}). Intenta de nuevo en unos minutos.`, { reintentable: true });
  }

  return {
    nombre: 'osm',
    descripcion: 'OpenStreetMap (Overpass API) – negocios del mapa con nombre comercial y, a veces, teléfono y web',
    async buscar(municipio: Municipio, filtro: FiltroFuente) {
      if (!filtro.valores.length) return { candidatos: [], meta: { omitida: 'sin etiquetas OSM' } };
      const vence = ahora() + presupuestoMs;

      let datos = await ejecutar((t) => consultaPorDivipola(municipio.codigo, filtro.valores, t), vence);
      let elementos = datos.elements ?? [];
      const limite = elementos.filter((e) => e.type === 'relation' && !e.tags);
      let ambito = 'limite_municipal';
      if (limite.length === 0) {
        ambito = `radio_${radioRespaldoM}m`;
        datos = await ejecutar((t) => consultaPorRadio(municipio.lat, municipio.lon, radioRespaldoM, filtro.valores, t), vence);
        elementos = datos.elements ?? [];
      }
      const candidatos = elementos.filter((e) => e.tags?.name).map((e) => osmACandidato(e, municipio));
      return {
        candidatos,
        meta: { ambito, relacionOsm: limite.map((r) => r.id), atribucion: '© OpenStreetMap contributors (ODbL)' },
      };
    },
  };
}
