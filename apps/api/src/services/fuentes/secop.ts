// Fuente SECOP II – Proveedores Registrados (datos.gov.co, dataset qmzu-gj57).
// Empresas registradas para venderle al Estado, con teléfono, correo y sitio web.
// El campo "ubicacion" trae el código DIVIPOLA (ej. CO-ANT-05615).

import type { Candidato, FiltroFuente, FuenteLeads, Municipio } from '~types/fuente.types';
import {
  extraerHost,
  normalizarDominio,
  normalizarEmails,
  normalizarNit,
  normalizarTelefonos,
  valorUtil,
} from '~utils/normalizar';
import { ErrorFuente } from './http';
import { type ConsultarSocrata } from './socrata';

export const DATASET_SECOP = 'qmzu-gj57';

export interface RegistroSecop {
  codigo?: string;
  nit?: string;
  nombre?: string;
  telefono?: string;
  correo?: string;
  sitio_web?: string;
  direccion?: string;
  ubicacion?: string;
  tipo_empresa?: string;
  esta_activa?: string;
  codigo_categoria_principal?: string;
  descripcion_categoria_principal?: string;
  espyme?: string;
}

export function consultaSecop(codMpio: string, prefijosUnspsc: string[], incluirPersonasNaturales: boolean): string {
  if (!/^\d{5}$/.test(codMpio)) throw new ErrorFuente('Código de municipio inválido.');
  for (const p of prefijosUnspsc) if (!/^\d{2,8}$/.test(p)) throw new ErrorFuente(`Prefijo UNSPSC inválido: ${p}`);
  const partes = [`ubicacion like '%-${codMpio}'`, `esta_activa='Si'`];
  if (!incluirPersonasNaturales) partes.push(`tipo_empresa not like 'PERSONA NATURAL%'`);
  if (prefijosUnspsc.length) {
    partes.push(`(${prefijosUnspsc.map((p) => `codigo_categoria_principal like 'V1.${p}%'`).join(' OR ')})`);
  }
  return partes.join(' AND ');
}

export function secopACandidato(r: RegistroSecop, municipio: Municipio): Candidato {
  const nit = normalizarNit(r.nit);
  const nombre = valorUtil(r.nombre);
  const web = valorUtil(r.sitio_web);
  const sitiosWeb: string[] = [];
  const redes: string[] = [];
  if (web && extraerHost(web)) (normalizarDominio(web) ? sitiosWeb : redes).push(web.toLowerCase());
  const categoria = valorUtil(r.descripcion_categoria_principal);
  return {
    fuente: 'secop',
    idExterno: valorUtil(r.codigo) ?? nit ?? `${municipio.codigo}:${nombre}`,
    nombre,
    razonSocial: nombre,
    nombreComercial: null,
    nit,
    codMpio: municipio.codigo,
    direccion: valorUtil(r.direccion),
    lat: null,
    lon: null,
    ciiu: null,
    categoriaFuente: categoria ? `SECOP ${categoria}` : null,
    telefonos: normalizarTelefonos(r.telefono, municipio.codigoDepartamento),
    emails: normalizarEmails([r.correo]),
    sitiosWeb,
    redes,
    esPersonaNatural: /PERSONA NATURAL/i.test(r.tipo_empresa ?? ''),
    crudo: r,
  };
}

export function crearFuenteSecop(consultar: ConsultarSocrata): FuenteLeads {
  return {
    nombre: 'secop',
    descripcion: 'SECOP II – Proveedores registrados del Estado con teléfono, correo y sitio web',
    async buscar(municipio: Municipio, filtro: FiltroFuente, opciones) {
      const $where = consultaSecop(municipio.codigo, filtro.valores, opciones.incluirPersonasNaturales);
      const { filas, truncado } = await consultar<RegistroSecop>(DATASET_SECOP, {
        $where,
        $select:
          'codigo, nit, nombre, telefono, correo, sitio_web, direccion, ubicacion, tipo_empresa, esta_activa, codigo_categoria_principal, descripcion_categoria_principal, espyme',
      });
      return { candidatos: filas.map((f) => secopACandidato(f, municipio)), meta: { truncado } };
    },
  };
}
