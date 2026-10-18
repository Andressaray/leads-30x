// Fuente RNT – Registro Nacional de Turismo (datos.gov.co, dataset thwd-ivmp).
// Prestadores turísticos activos con NIT, dirección, celular, teléfono y correo.
// No trae coordenadas: se cruza por NIT, teléfono, correo o dirección.

import type { Candidato, FiltroFuente, FuenteLeads, Municipio } from '~types/fuente.types';
import { normalizarEmails, normalizarNit, normalizarTelefonos, pareceNitDeEmpresa, valorUtil } from '~utils/normalizar';
import { ErrorFuente } from './http';
import { literalSoql, type ConsultarSocrata } from './socrata';

export const DATASET_RNT = 'thwd-ivmp';

export interface RegistroRnt {
  codigo_rnt?: string;
  nit?: string;
  razon_social_establecimiento?: string;
  direcci_n_comercial_establecimiento?: string;
  cod_mun?: string;
  num_celular?: string;
  n_m_tel_fono?: string;
  correo_establecimiento?: string;
  correo_prestador?: string;
  categoria?: string;
  sub_categoria?: string;
  tipo_prestador?: string;
  estado_rnt?: string;
}

export function consultaRnt(codMpio: string, categorias: string[]): string {
  if (!/^\d{5}$/.test(codMpio)) throw new ErrorFuente('Código de municipio inválido.');
  const partes = [`cod_mun=${literalSoql(codMpio)}`, `estado_rnt='ACTIVO'`];
  if (categorias.length) partes.push(`categoria in (${categorias.map(literalSoql).join(', ')})`);
  return partes.join(' AND ');
}

export function rntACandidato(r: RegistroRnt, municipio: Municipio): Candidato {
  const nit = normalizarNit(r.nit);
  const nombre = valorUtil(r.razon_social_establecimiento);
  const sub = valorUtil(r.sub_categoria) ?? valorUtil(r.categoria);
  return {
    fuente: 'rnt',
    idExterno: valorUtil(r.codigo_rnt) ?? `${municipio.codigo}:${nit}:${nombre}`,
    nombre,
    razonSocial: null,
    nombreComercial: nombre,
    nit,
    codMpio: valorUtil(r.cod_mun) ?? municipio.codigo,
    direccion: valorUtil(r.direcci_n_comercial_establecimiento),
    lat: null,
    lon: null,
    ciiu: null,
    categoriaFuente: sub ? `RNT ${sub}` : null,
    telefonos: normalizarTelefonos([r.num_celular, r.n_m_tel_fono], municipio.codigoDepartamento),
    emails: normalizarEmails([r.correo_establecimiento, r.correo_prestador]),
    sitiosWeb: [],
    redes: [],
    esPersonaNatural: !pareceNitDeEmpresa(nit),
    crudo: r,
  };
}

export function crearFuenteRnt(consultar: ConsultarSocrata): FuenteLeads {
  return {
    nombre: 'rnt',
    descripcion: 'Registro Nacional de Turismo – prestadores turísticos activos con correo y teléfono',
    async buscar(municipio: Municipio, filtro: FiltroFuente, opciones) {
      const { filas, truncado } = await consultar<RegistroRnt>(DATASET_RNT, { $where: consultaRnt(municipio.codigo, filtro.valores) });
      const todos = filas.map((f) => rntACandidato(f, municipio));
      // El RNT no dice si es persona natural; un NIT de empresa tiene 9 dígitos y empieza por 8 o 9.
      const candidatos = opciones.incluirPersonasNaturales ? todos : todos.filter((c) => !c.esPersonaNatural);
      return { candidatos, meta: { omitidos_personas_naturales: todos.length - candidatos.length, truncado } };
    },
  };
}
