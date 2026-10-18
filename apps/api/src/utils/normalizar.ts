// Limpieza de datos. Todo lo que se usa para comparar (deduplicar) pasa por
// aquí, para que dos fuentes que escriben distinto lo mismo terminen con la
// misma clave.

import type { Telefono } from '~types/fuente.types';

/** minúsculas, sin tildes, solo letras/números separados por un espacio */
export function normalizarTexto(texto: unknown): string {
  if (texto === undefined || texto === null) return '';
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Valores que las fuentes usan para decir "no hay dato". */
export function valorUtil(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^(no provisto|no definido|no aplica|n\/?a|sin dato|sin informacion|null|0|-)$/i.test(normalizarTexto(s) || s)) return null;
  return s;
}

const PALABRAS_IGNORADAS = new Set([
  'sas', 'sa', 'ltda', 'limitada', 'eu', 'cia', 'y', 'bic', 'zomac', 'scs', 'sca',
  'en', 'liquidacion', 'sociedad', 'acciones', 'simplificada', 'anonima',
  'de', 'del', 'la', 'el', 'los', 'las', 'e', 'and', 'co',
]);

/** Nombre de empresa reducido a sus palabras distintivas. */
export function normalizarNombreEmpresa(nombre: unknown): string {
  let t = normalizarTexto(nombre);
  t = t.replace(/\bs a s\b/g, 'sas').replace(/\bs a\b/g, 'sa').replace(/\be u\b/g, 'eu');
  return t
    .split(' ')
    .filter((p) => p && !PALABRAS_IGNORADAS.has(p))
    .join(' ');
}

// Indicativo regional (desde 2021 los fijos son 60X + 7 dígitos).
export const INDICATIVO_POR_DEPARTAMENTO: Record<string, string> = {
  '11': '1', '25': '1',
  '19': '2', '52': '2', '76': '2',
  '05': '4', '23': '4', '27': '4',
  '08': '5', '13': '5', '20': '5', '44': '5', '47': '5', '70': '5', '88': '5',
  '17': '6', '63': '6', '66': '6',
  '54': '7', '68': '7', '81': '7',
  '15': '8', '18': '8', '41': '8', '50': '8', '73': '8', '85': '8', '86': '8',
  '91': '8', '94': '8', '95': '8', '97': '8', '99': '8',
};

/**
 * Normaliza un teléfono colombiano a +57 + 10 dígitos.
 * @param codDepartamento 2 dígitos, para completar fijos viejos de 7 dígitos
 */
export function normalizarTelefono(valor: unknown, codDepartamento?: string): Telefono | null {
  if (!valor) return null;
  // "320 72 42 Ext 129": la extensión no es parte del número
  const sinExtension = String(valor).split(/\s*(?:ext\.?|extension|extensión|x)\s*\d/i)[0];
  let d = sinExtension.replace(/\D/g, '');
  if (!d) return null;

  if (d.startsWith('0057')) d = d.slice(4);
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10 && d.startsWith('0') && !d.startsWith('03')) d = d.slice(1);

  if (d.length === 10 && d.startsWith('3')) return { numero: `+57${d}`, tipo: 'movil' };
  if (d.length === 10 && d.startsWith('60') && /[124-8]/.test(d[2])) return { numero: `+57${d}`, tipo: 'fijo' };
  if (d.length === 8 && /[124-8]/.test(d[0])) return { numero: `+5760${d}`, tipo: 'fijo' };
  if (d.length === 7 && codDepartamento && INDICATIVO_POR_DEPARTAMENTO[codDepartamento]) {
    return { numero: `+5760${INDICATIVO_POR_DEPARTAMENTO[codDepartamento]}${d}`, tipo: 'fijo' };
  }
  return null;
}

/** Varios teléfonos en uno o más campos: "300 1234567; 604 4445555" */
export function normalizarTelefonos(valores: unknown, codDepartamento?: string): Telefono[] {
  const salida = new Map<string, Telefono>();
  for (const valor of ([] as unknown[]).concat(valores ?? [])) {
    if (!valor) continue;
    for (const parte of String(valor).split(/[;,/|]|\by\b/)) {
      const t = normalizarTelefono(parte, codDepartamento);
      if (t && !salida.has(t.numero)) salida.set(t.numero, t);
    }
  }
  return [...salida.values()];
}

const DOMINIOS_COMPARTIDOS = [
  'facebook.com', 'fb.com', 'instagram.com', 'wa.me', 'whatsapp.com', 'api.whatsapp.com',
  'linktr.ee', 'tiktok.com', 'twitter.com', 'x.com', 'youtube.com', 'linkedin.com',
  'google.com', 'goo.gl', 'maps.app.goo.gl', 'sites.google.com', 'business.site',
  'wixsite.com', 'blogspot.com', 'wordpress.com', 'tripadvisor.com', 'rappi.com.co',
  'ifood.com.co', 'domicilios.com', 'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com',
];

export function extraerHost(url: unknown): string | null {
  const v = valorUtil(url);
  if (!v) return null;
  let u = v.toLowerCase();
  if (!/^[a-z]+:\/\//.test(u)) u = `http://${u}`;
  try {
    return new URL(u).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

function esDominioCompartido(host: string): boolean {
  return DOMINIOS_COMPARTIDOS.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Dominio propio del negocio, o null si es una red social / sitio compartido. */
export function normalizarDominio(url: unknown): string | null {
  const host = extraerHost(url);
  if (!host || !host.includes('.')) return null;
  return esDominioCompartido(host) ? null : host;
}

export function normalizarEmail(valor: unknown): string | null {
  const v = valorUtil(valor);
  if (!v) return null;
  const e = v.toLowerCase().replace(/^mailto:/, '');
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export function normalizarEmails(valores: unknown[]): string[] {
  return [...new Set(valores.flatMap((v) => String(v ?? '').split(/[;,\s]+/)).map(normalizarEmail).filter((e): e is string => Boolean(e)))];
}

export function normalizarNit(valor: unknown): string | null {
  const v = valorUtil(valor);
  if (!v) return null;
  const base = v.split('-')[0].replace(/\D/g, '');
  return base.length >= 6 ? base : null;
}

/**
 * Los NIT de personas jurídicas en Colombia tienen 9 dígitos y empiezan por 8 o 9.
 * Un número distinto suele ser una cédula (persona natural).
 */
export function pareceNitDeEmpresa(nit: string | null): boolean {
  return Boolean(nit && /^[89]\d{8}$/.test(nit));
}

// Nomenclatura urbana colombiana: "Carrera 50 # 46-23" y "KR 50 46 23 BR CENTRO"
// son la misma placa.
const TIPOS_VIA: Record<string, string> = {
  carrera: 'kr', cra: 'kr', cr: 'kr', kr: 'kr', kra: 'kr', crr: 'kr', carrara: 'kr', k: 'kr',
  calle: 'cl', cll: 'cl', cl: 'cl', cal: 'cl', c: 'cl',
  diagonal: 'dg', dg: 'dg', diag: 'dg',
  transversal: 'tv', tv: 'tv', tr: 'tv', trans: 'tv', transv: 'tv', tranv: 'tv',
  avenida: 'av', av: 'av', avda: 'av', ak: 'ak', ac: 'ac',
  circular: 'cq', cq: 'cq', cir: 'cq',
};

/** Reduce una dirección a su placa: "kr 50 46 23", "dg 50b 46 16"; null si no tiene ese formato. */
export function normalizarDireccion(direccion: unknown): string | null {
  const v = valorUtil(direccion);
  if (!v) return null;
  const palabras = normalizarTexto(v)
    .replace(/\b(no|nro|numero|num|n)\b/g, ' ')
    .replace(/\b(\d+)\s+(bis)\b/g, '$1bis')
    .replace(/\b(\d+)\s+([a-h])\b/g, '$1$2')
    .replace(/\b(\d+[a-h]?)\s+(bis)\b/g, '$1bis')
    .split(' ')
    .filter(Boolean);
  const inicio = palabras.findIndex((p) => TIPOS_VIA[p]);
  if (inicio === -1) return null;
  // "CR 50 CL 46 23": el tipo de la vía que cruza no hace parte de la placa
  const resto = palabras.slice(inicio + 1).filter((p) => !TIPOS_VIA[p]);
  const [via, a, b, c] = [palabras[inicio], ...resto.slice(0, 3)];
  const esNumero = (x?: string) => /^\d+[a-h]?(bis)?$/.test(x || '');
  if (![a, b, c].every(esNumero)) return null;
  const sinCeros = (x: string) => x.replace(/^0+(?=\d)/, '');
  return `${TIPOS_VIA[via]} ${sinCeros(a)} ${sinCeros(b)} ${sinCeros(c)}`;
}

/** Distancia en metros entre dos puntos. */
export function distanciaMetros(
  a: { lat?: number | null; lon?: number | null },
  b: { lat?: number | null; lon?: number | null }
): number {
  if (![a.lat, a.lon, b.lat, b.lon].every((x) => typeof x === 'number' && Number.isFinite(x))) return Infinity;
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat! - a.lat!);
  const dLon = rad(b.lon! - a.lon!);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat!)) * Math.cos(rad(b.lat!)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Palabras que dicen el tipo de negocio pero no cuál es.
const PALABRAS_GENERICAS = new Set([
  'hotel', 'hoteles', 'hostal', 'hostel', 'restaurante', 'restaurant', 'cafeteria', 'cafetria', 'cafe',
  'panaderia', 'pasteleria', 'reposteria', 'drogueria', 'droguerias', 'farmacia', 'ferreteria',
  'supermercado', 'super', 'mercado', 'minimercado', 'tienda', 'tiendas', 'almacen', 'almacenes',
  'bar', 'discoteca', 'licoreria', 'licorera', 'estanco', 'peluqueria', 'barberia', 'sala', 'belleza',
  'spa', 'taller', 'lavadero', 'parqueadero', 'consultorio', 'clinica', 'centro', 'odontologia',
  'odontologico', 'veterinaria', 'veterinario', 'gimnasio', 'gym', 'papeleria', 'miscelanea',
  'comercializadora', 'distribuidora', 'distribuciones', 'inversiones', 'servicios', 'grupo',
  'colombia', 'asociacion', 'corporacion', 'fundacion', 'cooperativa', 'empresa', 'compania',
  'comercial', 'industrial', 'internacional', 'fonda', 'asados', 'pizzeria', 'comidas', 'rapidas',
  'sede', 'principal', 'oficina', 'local', 'punto', 'venta', 'ips', 'eps', 'agencia', 'viajes',
  'turismo', 'transportes', 'transporte',
]);

export function palabrasDistintivas(nombre: unknown, ignorar?: Set<string>): Set<string> {
  return new Set(
    normalizarNombreEmpresa(nombre)
      .split(' ')
      .filter((p) => p && !PALABRAS_GENERICAS.has(p) && !(ignorar && ignorar.has(p)))
  );
}

export interface ComparacionNombres {
  puntaje: number;
  comunes: number;
  minimo: number;
}

/** Compara dos nombres por sus palabras distintivas (Dice; 0.9 si uno contiene al otro con 2+ palabras). */
export function compararNombres(a: unknown, b: unknown, ignorar?: Set<string>): ComparacionNombres {
  const pa = palabrasDistintivas(a, ignorar);
  const pb = palabrasDistintivas(b, ignorar);
  const minimo = Math.min(pa.size, pb.size);
  if (minimo === 0) return { puntaje: 0, comunes: 0, minimo };
  let comunes = 0;
  for (const p of pa) if (pb.has(p)) comunes += 1;
  let puntaje = (2 * comunes) / (pa.size + pb.size);
  if (comunes === minimo && minimo >= 2) puntaje = Math.max(puntaje, 0.9);
  return { puntaje, comunes, minimo };
}

export function similitudNombres(a: unknown, b: unknown, ignorar?: Set<string>): number {
  return compararNombres(a, b, ignorar).puntaje;
}
