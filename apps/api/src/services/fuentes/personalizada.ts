// Fuente agregada por el equipo: cualquier dataset de datos.gov.co (Socrata) con
// negocios por municipio. No se programa nada: se indica qué columna trae el
// municipio, el nombre, el NIT, el teléfono, etc. (ver /api/fuentes).

import type { Candidato, FiltroFuente, FuenteLeads, Municipio } from '~types/fuente.types';
import {
  extraerHost,
  normalizarDominio,
  normalizarEmails,
  normalizarNit,
  normalizarTelefonos,
  normalizarTexto,
  pareceNitDeEmpresa,
  valorUtil,
} from '~utils/normalizar';
import { ErrorFuente, pedirJson, type FetchLike } from './http';
import { DATOS_GOV_BASE, literalSoql, type ConsultarSocrata } from './socrata';

export const PATRON_DATASET = /^[a-z0-9]{4}-[a-z0-9]{4}$/;
/** Nombres de columna de Socrata: letras, números, guion bajo (y : o @ en las calculadas). */
export const PATRON_COLUMNA = /^[a-z_:@][a-z0-9_:@]{0,62}$/i;

/** Cómo viene el municipio en el dataset. */
export const FORMATOS_MUNICIPIO = ['codigo', 'codigo_numero', 'nombre'] as const;
export type FormatoMunicipio = (typeof FORMATOS_MUNICIPIO)[number];

/** Qué columna del dataset trae cada dato. Solo municipio y nombre son obligatorias. */
export interface CamposDatosAbiertos {
  municipio: string;
  /** codigo = DIVIPOLA de 5 dígitos como texto ("05001"); codigo_numero = número (5001); nombre = "MEDELLÍN" */
  formatoMunicipio: FormatoMunicipio;
  /** Solo con formato "nombre": columna del departamento para distinguir municipios homónimos. */
  departamento?: string | null;
  nombre: string;
  id?: string | null;
  nit?: string | null;
  direccion?: string | null;
  telefonos?: string[];
  emails?: string[];
  sitioWeb?: string | null;
  categoria?: string | null;
}

export interface DefinicionDatosAbiertos {
  clave: string;
  nombre: string;
  dataset: string;
  campos: CamposDatosAbiertos;
  /** Condición SoQL extra (ej. estado='ACTIVO'). */
  condicion?: string | null;
  version?: string;
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
/** El nombre tal cual y sin tildes, en mayúsculas: "MEDELLÍN" → ["MEDELLÍN", "MEDELLIN"]. */
const variantes = (s: string) => [...new Set([s.toUpperCase(), sinTildes(s).toUpperCase()])];

/** Columnas que se usan del dataset, sin repetir. */
export function columnasUsadas(c: CamposDatosAbiertos): string[] {
  const todas = [c.municipio, c.departamento, c.nombre, c.id, c.nit, c.direccion, c.sitioWeb, c.categoria, ...(c.telefonos ?? []), ...(c.emails ?? [])];
  return [...new Set(todas.filter((x): x is string => Boolean(x)))];
}

/** Valida una definición; devuelve los problemas encontrados (vacío = válida). */
export function problemasDefinicion(d: Pick<DefinicionDatosAbiertos, 'dataset' | 'campos' | 'condicion'>): string[] {
  const p: string[] = [];
  if (!PATRON_DATASET.test(d.dataset ?? '')) p.push('dataset debe ser un id de datos.gov.co como "abcd-1234".');
  const c = d.campos;
  if (!c?.municipio) p.push('Indica la columna del municipio.');
  if (!c?.nombre) p.push('Indica la columna del nombre del negocio.');
  if (c && !FORMATOS_MUNICIPIO.includes(c.formatoMunicipio)) p.push(`formatoMunicipio debe ser: ${FORMATOS_MUNICIPIO.join(', ')}.`);
  if (c) for (const col of columnasUsadas(c)) if (!PATRON_COLUMNA.test(col)) p.push(`Nombre de columna inválido: "${col}".`);
  if (d.condicion && (/;|--|\/\*/.test(d.condicion) || d.condicion.length > 300)) p.push('La condición extra no puede tener ";", comentarios ni pasar de 300 caracteres.');
  return p;
}

/** $where de SoQL para un municipio. */
export function consultaPersonalizada(d: Pick<DefinicionDatosAbiertos, 'campos' | 'condicion'>, municipio: Municipio): string {
  const c = d.campos;
  if (!/^\d{5}$/.test(municipio.codigo)) throw new ErrorFuente('Código de municipio inválido.');
  let partes: string[];
  if (c.formatoMunicipio === 'codigo') partes = [`${c.municipio}=${literalSoql(municipio.codigo)}`];
  else if (c.formatoMunicipio === 'codigo_numero') partes = [`${c.municipio}=${Number(municipio.codigo)}`];
  else {
    partes = [`upper(${c.municipio}) in (${variantes(municipio.nombre).map(literalSoql).join(', ')})`];
    if (c.departamento) partes.push(`upper(${c.departamento}) in (${variantes(municipio.departamento).map(literalSoql).join(', ')})`);
  }
  if (d.condicion?.trim()) partes.push(`(${d.condicion.trim()})`);
  return partes.join(' AND ');
}

/** Socrata entrega a veces objetos (tipo URL: { url }) o números: todo a texto. */
function texto(v: unknown): string | null {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return valorUtil(o.url ?? o.phone_number ?? o.human_address ?? null);
  }
  return valorUtil(v);
}

export function filaACandidato(fila: Record<string, unknown>, d: DefinicionDatosAbiertos, municipio: Municipio): Candidato | null {
  const c = d.campos;
  const leer = (col?: string | null) => (col ? texto(fila[col]) : null);
  const nombre = leer(c.nombre);
  if (!nombre) return null;
  const nit = normalizarNit(leer(c.nit));
  const direccion = leer(c.direccion);
  const web = leer(c.sitioWeb);
  const sitiosWeb: string[] = [];
  const redes: string[] = [];
  if (web && extraerHost(web)) (normalizarDominio(web) ? sitiosWeb : redes).push(web.toLowerCase());
  const categoria = leer(c.categoria);
  return {
    fuente: d.clave,
    idExterno: leer(c.id) ?? nit ?? `${municipio.codigo}:${normalizarTexto(nombre)}:${normalizarTexto(direccion)}`,
    nombre,
    razonSocial: nit && pareceNitDeEmpresa(nit) ? nombre : null,
    nombreComercial: nombre,
    nit,
    codMpio: municipio.codigo,
    direccion,
    lat: null,
    lon: null,
    ciiu: null,
    categoriaFuente: categoria ? `${d.clave.toUpperCase()} ${categoria}` : null,
    telefonos: normalizarTelefonos((c.telefonos ?? []).map(leer), municipio.codigoDepartamento),
    emails: normalizarEmails((c.emails ?? []).map(leer)),
    sitiosWeb,
    redes,
    esPersonaNatural: nit ? !pareceNitDeEmpresa(nit) : null,
    crudo: fila,
  };
}

export function crearFuentePersonalizada(consultar: ConsultarSocrata, d: DefinicionDatosAbiertos): FuenteLeads {
  return {
    nombre: d.clave,
    descripcion: d.nombre,
    version: d.version,
    async buscar(municipio: Municipio, _filtro: FiltroFuente, opciones) {
      const { filas, truncado } = await consultar<Record<string, unknown>>(d.dataset, {
        $where: consultaPersonalizada(d, municipio),
        $select: columnasUsadas(d.campos).join(', '),
      });
      const todos = filas.map((f) => filaACandidato(f, d, municipio)).filter((x): x is Candidato => x !== null);
      const candidatos = opciones.incluirPersonasNaturales ? todos : todos.filter((x) => x.esPersonaNatural !== true);
      return {
        candidatos,
        meta: { truncado, sin_nombre: filas.length - todos.length, omitidos_personas_naturales: todos.length - candidatos.length },
      };
    },
  };
}

// ── Inspección de un dataset (para armar la fuente desde la web) ─────────────

export interface ColumnaDataset {
  campo: string;
  nombre: string;
  tipo: string | null;
}

export interface InspeccionDataset {
  dataset: string;
  nombre: string | null;
  descripcion: string | null;
  enlace: string;
  columnas: ColumnaDataset[];
  muestra: Record<string, unknown>[];
  sugerencia: Partial<CamposDatosAbiertos>;
}

export interface OpcionesInspeccion {
  appToken?: string;
  timeoutMs?: number;
  userAgent?: string;
  fetchImpl?: FetchLike;
  /** Por defecto https://www.datos.gov.co */
  sitio?: string;
}

/** Acepta el id ("abcd-1234") o un enlace de datos.gov.co que lo contenga. */
export function extraerDataset(entrada: string): string | null {
  const t = String(entrada ?? '').trim().toLowerCase();
  if (PATRON_DATASET.test(t)) return t;
  // https://www.datos.gov.co/d/thwd-ivmp · /resource/thwd-ivmp.json · /Turismo/Registro-Nacional/thwd-ivmp/about_data
  const m = t.match(/\/(?:d|resource|views|dataset)\/([a-z0-9]{4}-[a-z0-9]{4})/) ?? t.match(/\/([a-z0-9]{4}-[a-z0-9]{4})(?:\.json)?(?:[/?#]|$)/);
  return m?.[1] ?? null;
}

/** Adivina qué columna es cuál por su nombre. El usuario la revisa antes de guardar. */
export function sugerirCampos(columnas: string[]): Partial<CamposDatosAbiertos> {
  const n = columnas.map((c) => ({ c, t: normalizarTexto(c.replace(/_/g, ' ')) }));
  const primera = (re: RegExp, evitar?: RegExp) => n.find((x) => re.test(x.t) && !(evitar && evitar.test(x.t)))?.c ?? null;
  const todas = (re: RegExp) => n.filter((x) => re.test(x.t)).map((x) => x.c);

  const codMpio = primera(/(cod|codigo|divipola).*(mun|mpio|ciudad)|(mun|mpio|ciudad).*(cod|codigo|divipola)|^divipola$|cod mun/);
  const nomMpio = primera(/municipio|ciudad|mpio/, /cod|codigo|divipola/);
  const s: Partial<CamposDatosAbiertos> = {};
  if (codMpio) Object.assign(s, { municipio: codMpio, formatoMunicipio: 'codigo' as const });
  else if (nomMpio) {
    Object.assign(s, { municipio: nomMpio, formatoMunicipio: 'nombre' as const });
    const dpto = primera(/departamento|dpto/, /cod|codigo/);
    if (dpto) s.departamento = dpto;
  }
  const nombre =
    primera(/razon social|nombre comercial|nombre establecimiento|nombre empresa|nombre prestador|nombre sede/) ?? primera(/^nombre$|nombre|razon/, /municipio|departamento|ciudad|contacto|representante|categoria|tipo/);
  if (nombre) s.nombre = nombre;
  const nit = primera(/^nit$|nit|numero identificacion|num identificacion|identificacion/, /tipo/);
  if (nit) s.nit = nit;
  const direccion = primera(/direccion|direcci n/, /correo|electronica|web/);
  if (direccion) s.direccion = direccion;
  const telefonos = todas(/telefono|tel fono|celular|movil|whatsapp/);
  if (telefonos.length) s.telefonos = telefonos.slice(0, 3);
  const emails = todas(/correo|email|e mail/);
  if (emails.length) s.emails = emails.slice(0, 3);
  const web = primera(/sitio web|pagina web|web|url/);
  if (web) s.sitioWeb = web;
  const categoria = primera(/categoria|actividad|clase|tipo establecimiento|sector/, /cod|codigo/);
  if (categoria) s.categoria = categoria;
  const id = primera(/^codigo$|codigo rnt|codigo habilitacion|^id$|registro/, /municipio|departamento|mun|categoria|ciiu|postal/);
  if (id) s.id = id;
  return s;
}

export async function inspeccionarDataset(dataset: string, o: OpcionesInspeccion = {}): Promise<InspeccionDataset> {
  if (!PATRON_DATASET.test(dataset)) throw new ErrorFuente(`Dataset inválido: ${dataset}`);
  const sitio = (o.sitio ?? DATOS_GOV_BASE.replace(/\/resource$/, '')).replace(/\/$/, '');
  const headers = {
    Accept: 'application/json',
    ...(o.appToken ? { 'X-App-Token': o.appToken } : {}),
    ...(o.userAgent ? { 'User-Agent': o.userAgent } : {}),
  };
  const pedir = <T>(url: string) => pedirJson<T>(url, { headers, timeoutMs: o.timeoutMs ?? 20000, fetchImpl: o.fetchImpl, maxBytes: 5e6 });

  const [meta, muestra] = await Promise.all([
    pedir<{ name?: string; description?: string; columns?: { fieldName?: string; name?: string; dataTypeName?: string }[] }>(`${sitio}/api/views/${dataset}.json`).catch(
      () => null
    ),
    pedir<Record<string, unknown>[]>(`${sitio}/resource/${dataset}.json?$limit=5`),
  ]);
  if (!Array.isArray(muestra)) throw new ErrorFuente('datos.gov.co respondió en un formato inesperado.');

  let columnas: ColumnaDataset[] = (meta?.columns ?? [])
    .filter((c) => c.fieldName && !c.fieldName.startsWith(':'))
    .map((c) => ({ campo: c.fieldName!, nombre: c.name ?? c.fieldName!, tipo: c.dataTypeName ?? null }));
  if (!columnas.length) {
    const vistas = new Set(muestra.flatMap((f) => Object.keys(f)).filter((k) => !k.startsWith(':')));
    columnas = [...vistas].map((campo) => ({ campo, nombre: campo, tipo: null }));
  }
  return {
    dataset,
    nombre: meta?.name ?? null,
    descripcion: meta?.description ? meta.description.slice(0, 500) : null,
    enlace: `${sitio}/d/${dataset}`,
    columnas,
    muestra: muestra.slice(0, 3),
    sugerencia: sugerirCampos(columnas.map((c) => c.campo)),
  };
}
