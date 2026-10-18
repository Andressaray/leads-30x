// Fuente REPS – Registro Especial de Prestadores y Sedes de Servicios de Salud
// (datos.gov.co, dataset c36g-9fc2). Una fila por sede, con teléfono y correo.

import type { Candidato, FiltroFuente, FuenteLeads, Municipio } from '~types/fuente.types';
import { normalizarEmails, normalizarNit, normalizarTelefonos, valorUtil } from '~utils/normalizar';
import { ErrorFuente } from './http';
import { type ConsultarSocrata } from './socrata';

export const DATASET_REPS = 'c36g-9fc2';

export interface RegistroReps {
  codigohabilitacionsede?: string;
  nombresede?: string;
  nombreprestador?: string;
  tipoid?: string;
  numeroidentificacion?: string;
  claseprestador?: string;
  municipiosede?: string;
  direcci_nsede?: string;
  t_lefonosede?: string;
  telefonoprestador?: string;
  email_sede?: string;
  email_prestador?: string;
}

export function consultaReps(codMpio: string, incluirPersonasNaturales: boolean): string {
  if (!/^\d{5}$/.test(codMpio)) throw new ErrorFuente('Código de municipio inválido.');
  // tipoid: NI = NIT (empresa); CC, CE, PT = personas naturales
  return `municipiosede='${codMpio}'${incluirPersonasNaturales ? '' : ` AND tipoid='NI'`}`;
}

export function repsACandidato(r: RegistroReps, municipio: Municipio): Candidato {
  const esEmpresa = r.tipoid === 'NI';
  const sede = valorUtil(r.nombresede);
  const prestador = valorUtil(r.nombreprestador);
  const clase = valorUtil(r.claseprestador);
  return {
    fuente: 'reps',
    idExterno: valorUtil(r.codigohabilitacionsede) ?? `${municipio.codigo}:${r.numeroidentificacion}:${sede}`,
    nombre: sede ?? prestador,
    razonSocial: esEmpresa ? prestador : null,
    nombreComercial: sede,
    nit: esEmpresa ? normalizarNit(r.numeroidentificacion) : null,
    codMpio: valorUtil(r.municipiosede) ?? municipio.codigo,
    direccion: valorUtil(r.direcci_nsede),
    lat: null,
    lon: null,
    ciiu: null,
    categoriaFuente: clase ? `REPS ${clase}` : null,
    telefonos: normalizarTelefonos([r.t_lefonosede, r.telefonoprestador], municipio.codigoDepartamento),
    emails: normalizarEmails([r.email_sede, r.email_prestador]),
    sitiosWeb: [],
    redes: [],
    esPersonaNatural: !esEmpresa,
    crudo: r,
  };
}

export function crearFuenteReps(consultar: ConsultarSocrata): FuenteLeads {
  return {
    nombre: 'reps',
    descripcion: 'REPS – sedes de prestadores de servicios de salud con teléfono y correo',
    async buscar(municipio: Municipio, _filtro: FiltroFuente, opciones) {
      const { filas, truncado } = await consultar<RegistroReps>(DATASET_REPS, {
        $where: consultaReps(municipio.codigo, opciones.incluirPersonasNaturales),
      });
      return { candidatos: filas.map((f) => repsACandidato(f, municipio)), meta: { truncado } };
    },
  };
}
