// Resuelve lo que escribe el usuario ("medellin", "Granada", "Bogotá") a un
// municipio oficial de la DIVIPOLA (DANE).

import type { Municipio } from '~types/fuente.types';
import { normalizarTexto } from '~utils/normalizar';
import { MUNICIPIOS_CSV } from './municipios.data';

export const DEPARTAMENTOS: Record<string, string> = {
  '05': 'Antioquia', '08': 'Atlántico', '11': 'Bogotá, D.C.', '13': 'Bolívar',
  '15': 'Boyacá', '17': 'Caldas', '18': 'Caquetá', '19': 'Cauca', '20': 'Cesar',
  '23': 'Córdoba', '25': 'Cundinamarca', '27': 'Chocó', '41': 'Huila',
  '44': 'La Guajira', '47': 'Magdalena', '50': 'Meta', '52': 'Nariño',
  '54': 'Norte de Santander', '63': 'Quindío', '66': 'Risaralda', '68': 'Santander',
  '70': 'Sucre', '73': 'Tolima', '76': 'Valle del Cauca', '81': 'Arauca',
  '85': 'Casanare', '86': 'Putumayo',
  '88': 'Archipiélago de San Andrés, Providencia y Santa Catalina',
  '91': 'Amazonas', '94': 'Guainía', '95': 'Guaviare', '97': 'Vaupés', '99': 'Vichada',
};

const ALIAS_MUNICIPIOS: Record<string, string> = {
  bogota: '11001', 'bogota dc': '11001', cali: '76001', cartagena: '13001', cucuta: '54001',
  buga: '76111', tumaco: '52835', mompox: '13468', mompos: '13468', ubate: '25843',
  mariquita: '73443', tolu: '70820', since: '70742',
  'santa fe de antioquia': '05042', 'santafe de antioquia': '05042',
};

const ALIAS_DEPARTAMENTOS: Record<string, string> = {
  bogota: '11', valle: '76', 'san andres': '88', 'norte santander': '54', guajira: '44',
};

const TIPOS: Record<string, string> = { M: 'Municipio', I: 'Isla', A: 'Área no municipalizada' };

interface MunicipioIndexado extends Municipio {
  clave: string;
}

export const MUNICIPIOS: MunicipioIndexado[] = MUNICIPIOS_CSV.trim()
  .split(/\r?\n/)
  .map((linea) => {
    const [codigo, nombre, tipo, lat, lon] = linea.split(';');
    const codDpto = codigo.slice(0, 2);
    return {
      codigo,
      nombre,
      tipo: TIPOS[tipo] ?? tipo,
      codigoDepartamento: codDpto,
      departamento: DEPARTAMENTOS[codDpto],
      lat: Number(lat),
      lon: Number(lon),
      clave: normalizarTexto(nombre),
    };
  });

const POR_CODIGO = new Map(MUNICIPIOS.map((m) => [m.codigo, m]));

function sinClave({ clave: _clave, ...m }: MunicipioIndexado): Municipio {
  return m;
}

export function obtenerMunicipio(codigo: string): Municipio | undefined {
  const m = POR_CODIGO.get(codigo);
  return m ? sinClave(m) : undefined;
}

/** Código de 2 dígitos; null si no se pasó nada; undefined si no se reconoce. */
export function resolverDepartamento(texto: unknown): string | null | undefined {
  if (texto === undefined || texto === null || String(texto).trim() === '') return null;
  const valor = String(texto).trim();
  if (/^\d{1,2}$/.test(valor)) {
    const cod = valor.padStart(2, '0');
    return DEPARTAMENTOS[cod] ? cod : undefined;
  }
  const clave = normalizarTexto(valor);
  if (ALIAS_DEPARTAMENTOS[clave]) return ALIAS_DEPARTAMENTOS[clave];
  const entradas = Object.entries(DEPARTAMENTOS);
  const exacto = entradas.find(([, nombre]) => normalizarTexto(nombre) === clave);
  if (exacto) return exacto[0];
  const prefijo = entradas.find(([, nombre]) => normalizarTexto(nombre).startsWith(clave));
  return prefijo ? prefijo[0] : undefined;
}

export interface CandidatoMunicipio {
  codigo: string;
  nombre: string;
  departamento: string;
}

export type ResolucionMunicipio =
  | { municipio: Municipio }
  | { candidatos: CandidatoMunicipio[] }
  | { error: string };

export function resolverMunicipio(p: { ciudad?: string; departamento?: string; codigo?: string }): ResolucionMunicipio {
  if (p.codigo) {
    const cod = String(p.codigo).trim();
    if (!/^\d{5}$/.test(cod)) return { error: 'El código DIVIPOLA debe tener 5 dígitos.' };
    const m = obtenerMunicipio(cod);
    return m ? { municipio: m } : { error: `No existe el municipio con código ${cod}.` };
  }
  if (!p.ciudad || !String(p.ciudad).trim()) {
    return { error: 'Falta la ciudad. Envía "ciudad" (y opcionalmente "departamento").' };
  }

  const codDpto = resolverDepartamento(p.departamento);
  if (codDpto === undefined) return { error: `No reconozco el departamento "${p.departamento}".` };

  const clave = normalizarTexto(p.ciudad);
  let encontrados: MunicipioIndexado[];
  const alias = ALIAS_MUNICIPIOS[clave];
  if (alias && (!codDpto || alias.startsWith(codDpto))) {
    encontrados = [POR_CODIGO.get(alias)!];
  } else {
    encontrados = MUNICIPIOS.filter((m) => m.clave === clave);
    if (encontrados.length === 0) {
      encontrados = MUNICIPIOS.filter((m) => m.clave.endsWith(` ${clave}`) || m.clave.startsWith(`${clave} `));
    }
  }
  if (codDpto) encontrados = encontrados.filter((m) => m.codigoDepartamento === codDpto);

  if (encontrados.length === 1) return { municipio: sinClave(encontrados[0]) };
  if (encontrados.length > 1) {
    return {
      candidatos: encontrados.map((m) => ({ codigo: m.codigo, nombre: m.nombre, departamento: m.departamento })),
    };
  }
  return {
    error: codDpto ? `No encontré "${p.ciudad}" en ${DEPARTAMENTOS[codDpto]}.` : `No encontré el municipio "${p.ciudad}".`,
  };
}

export function buscarMunicipios(q: string, codDpto: string | null, limite: number): Municipio[] {
  const clave = normalizarTexto(q);
  return MUNICIPIOS.filter((m) => (!clave || m.clave.includes(clave)) && (!codDpto || m.codigoDepartamento === codDpto))
    .slice(0, limite)
    .map(sinClave);
}
