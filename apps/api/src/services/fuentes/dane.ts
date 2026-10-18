// Fuente DANE – Registro Estadístico de Empresas.
// Usa el servicio JSON que consume el geovisor público del DANE. Devuelve
// empresas jurídicas activas con NIT, razón social, dirección, CIIU y
// coordenadas. NO trae teléfono ni correo: esos llegan al cruzar con otras fuentes.
// El servicio arma su consulta con lo que recibe: solo se le envían códigos numéricos validados.

import type { Candidato, FiltroFuente, FuenteLeads, Municipio } from '~types/fuente.types';
import { normalizarNit, normalizarTelefonos, valorUtil } from '~utils/normalizar';
import { ErrorFuente, esperar, pedirJson, type FetchLike } from './http';

export const URL_DANE_POR_DEFECTO =
  'https://geoportal.dane.gov.co/laboratorio/serviciosjson/directoriodeempresas/coordenadas1.php';

interface RegistroDane {
  NIT?: string;
  RAZON_SOCIAL?: string;
  NOMBRE_COMERCIAL?: string;
  DIRECCION?: string;
  MUNI_ID_DPTO?: string;
  MUNI_ID_MPIO?: string;
  TELEFONO1?: string;
  CIIU_ID_CIIU_4_V?: string;
  LATITUD?: string;
  LONGITUD?: string;
}

export function construirUrlDane(base: string, codMpio: string, ciiu?: string): string {
  if (!/^\d{5}$/.test(codMpio)) throw new ErrorFuente('Código de municipio inválido.');
  if (ciiu !== undefined && !/^\d{4}$/.test(ciiu)) throw new ErrorFuente('Código CIIU inválido.');
  const url = new URL(base);
  url.searchParams.set('cod_dpto', codMpio.slice(0, 2));
  url.searchParams.set('cod_mpio', codMpio);
  if (ciiu) url.searchParams.set('ciiu', ciiu);
  return url.toString();
}

export function daneACandidato(r: RegistroDane, municipio: Municipio): Candidato {
  const codMpio = `${r.MUNI_ID_DPTO ?? ''}${r.MUNI_ID_MPIO ?? ''}`.trim();
  const nit = normalizarNit(r.NIT);
  const lat = Number.parseFloat(r.LATITUD ?? '');
  const lon = Number.parseFloat(r.LONGITUD ?? '');
  const razonSocial = valorUtil(r.RAZON_SOCIAL);
  const nombreComercial = valorUtil(r.NOMBRE_COMERCIAL);
  const ciiu = valorUtil(r.CIIU_ID_CIIU_4_V);
  return {
    fuente: 'dane',
    idExterno: nit ?? `${codMpio}:${razonSocial}`,
    nombre: nombreComercial ?? razonSocial,
    razonSocial,
    nombreComercial,
    nit,
    codMpio: /^\d{5}$/.test(codMpio) ? codMpio : municipio.codigo,
    direccion: valorUtil(r.DIRECCION),
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    ciiu,
    categoriaFuente: ciiu ? `CIIU ${ciiu}` : null,
    telefonos: normalizarTelefonos(r.TELEFONO1, municipio.codigoDepartamento),
    emails: [],
    sitiosWeb: [],
    redes: [],
    esPersonaNatural: false,
    crudo: r,
  };
}

/** Ejecuta `tarea` sobre cada elemento con como máximo `limite` en curso a la vez, conservando el orden. */
async function enParalelo<T, R>(items: T[], limite: number, tarea: (item: T) => Promise<R>): Promise<R[]> {
  const resultados = new Array<R>(items.length);
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < items.length) {
      const i = siguiente;
      siguiente += 1;
      resultados[i] = await tarea(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limite, items.length)) }, trabajador));
  return resultados;
}

export function crearFuenteDane(
  o: {
    url?: string;
    timeoutMs?: number;
    maxBytes?: number;
    userAgent?: string;
    /** Cuántos códigos CIIU se consultan a la vez (el servicio es público: no subir mucho) */
    consultasEnParalelo?: number;
    /** Pausa antes del único reintento cuando el DANE responde 5xx o se cae la conexión */
    pausaReintentoMs?: number;
    fetchImpl?: FetchLike;
  } = {}
): FuenteLeads {
  const base = o.url ?? URL_DANE_POR_DEFECTO;
  const paralelo = o.consultasEnParalelo ?? 3;
  const pausa = o.pausaReintentoMs ?? 1500;

  async function consultarUnaVez(codMpio: string, ciiu?: string): Promise<RegistroDane[]> {
    const datos = await pedirJson<{ estado?: boolean; resultado?: RegistroDane[] }>(construirUrlDane(base, codMpio, ciiu), {
      timeoutMs: o.timeoutMs ?? 60000,
      maxBytes: o.maxBytes ?? 60e6,
      fetchImpl: o.fetchImpl,
      headers: { Accept: 'application/json', ...(o.userAgent ? { 'User-Agent': o.userAgent } : {}) },
    });
    if (!datos || datos.estado !== true || !Array.isArray(datos.resultado)) {
      throw new ErrorFuente('El servicio del DANE respondió sin resultados válidos.');
    }
    return datos.resultado;
  }

  async function consultar(codMpio: string, ciiu?: string): Promise<RegistroDane[]> {
    try {
      return await consultarUnaVez(codMpio, ciiu);
    } catch (err) {
      const e = err as ErrorFuente;
      // Un 500 del DANE suele ser pasajero; un timeout no: reintentarlo duplicaría la espera.
      if (!e.reintentable || e.message.startsWith('Tiempo de espera')) throw err;
      await esperar(Math.min(e.retryAfterMs ?? pausa, 10000));
      return consultarUnaVez(codMpio, ciiu);
    }
  }

  return {
    nombre: 'dane',
    descripcion: 'DANE – Registro Estadístico de Empresas (personas jurídicas activas; sin datos de contacto)',
    async buscar(municipio: Municipio, filtro: FiltroFuente) {
      const codigos: (string | undefined)[] = filtro.valores.length ? filtro.valores : [undefined];
      const lotes = await enParalelo(codigos, paralelo, (ciiu) => consultar(municipio.codigo, ciiu));
      const vistos = new Set<string>();
      const candidatos: Candidato[] = [];
      for (const r of lotes.flat()) {
        const c = daneACandidato(r, municipio);
        if (vistos.has(c.idExterno)) continue;
        vistos.add(c.idExterno);
        candidatos.push(c);
      }
      return { candidatos, meta: { consultas: codigos.length } };
    },
  };
}
