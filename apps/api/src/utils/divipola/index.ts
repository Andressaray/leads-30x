// Resolves what the user types ("medellin", "Granada", "Bogotá") to an
// official DIVIPOLA (DANE) municipality.

import type { Municipality } from '~types/source.types';
import { normalizeText } from '~utils/normalize';
import { MUNICIPALITIES_CSV } from './municipalities.data';

export const DEPARTMENTS: Record<string, string> = {
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

const MUNICIPALITY_ALIASES: Record<string, string> = {
  bogota: '11001', 'bogota dc': '11001', cali: '76001', cartagena: '13001', cucuta: '54001',
  buga: '76111', tumaco: '52835', mompox: '13468', mompos: '13468', ubate: '25843',
  mariquita: '73443', tolu: '70820', since: '70742',
  'santa fe de antioquia': '05042', 'santafe de antioquia': '05042',
};

const DEPARTMENT_ALIASES: Record<string, string> = {
  bogota: '11', valle: '76', 'san andres': '88', 'norte santander': '54', guajira: '44',
};

const TYPES: Record<string, string> = { M: 'Municipio', I: 'Isla', A: 'Área no municipalizada' };

interface IndexedMunicipality extends Municipality {
  key: string;
}

export const MUNICIPALITIES: IndexedMunicipality[] = MUNICIPALITIES_CSV.trim()
  .split(/\r?\n/)
  .map((line) => {
    const [code, name, type, lat, lon] = line.split(';');
    const departmentCode = code.slice(0, 2);
    return {
      code,
      name,
      type: TYPES[type] ?? type,
      departmentCode: departmentCode,
      department: DEPARTMENTS[departmentCode],
      lat: Number(lat),
      lon: Number(lon),
      key: normalizeText(name),
    };
  });

const BY_CODE = new Map(MUNICIPALITIES.map((m) => [m.code, m]));

function withoutKey({ key: _key, ...m }: IndexedMunicipality): Municipality {
  return m;
}

export function getMunicipality(code: string): Municipality | undefined {
  const m = BY_CODE.get(code);
  return m ? withoutKey(m) : undefined;
}

/** 2-digit code; null if nothing was passed; undefined if not recognized. */
export function resolveDepartment(text: unknown): string | null | undefined {
  if (text === undefined || text === null || String(text).trim() === '') return null;
  const value = String(text).trim();
  if (/^\d{1,2}$/.test(value)) {
    const code = value.padStart(2, '0');
    return DEPARTMENTS[code] ? code : undefined;
  }
  const key = normalizeText(value);
  if (DEPARTMENT_ALIASES[key]) return DEPARTMENT_ALIASES[key];
  const entries = Object.entries(DEPARTMENTS);
  const exact = entries.find(([, name]) => normalizeText(name) === key);
  if (exact) return exact[0];
  const prefix = entries.find(([, name]) => normalizeText(name).startsWith(key));
  return prefix ? prefix[0] : undefined;
}

export interface MunicipalityCandidate {
  code: string;
  name: string;
  department: string;
}

export type MunicipalityResolution =
  | { municipality: Municipality }
  | { candidates: MunicipalityCandidate[] }
  | { error: string };

export function resolveMunicipality(p: { city?: string; department?: string; code?: string }): MunicipalityResolution {
  if (p.code) {
    const code = String(p.code).trim();
    if (!/^\d{5}$/.test(code)) return { error: 'El código DIVIPOLA debe tener 5 dígitos.' };
    const m = getMunicipality(code);
    return m ? { municipality: m } : { error: `No existe el municipio con código ${code}.` };
  }
  if (!p.city || !String(p.city).trim()) {
    return { error: 'Falta la ciudad. Envía "ciudad" (y opcionalmente "departamento").' };
  }

  const departmentCode = resolveDepartment(p.department);
  if (departmentCode === undefined) return { error: `No reconozco el departamento "${p.department}".` };

  const key = normalizeText(p.city);
  let found: IndexedMunicipality[];
  const alias = MUNICIPALITY_ALIASES[key];
  if (alias && (!departmentCode || alias.startsWith(departmentCode))) {
    found = [BY_CODE.get(alias)!];
  } else {
    found = MUNICIPALITIES.filter((m) => m.key === key);
    if (found.length === 0) {
      found = MUNICIPALITIES.filter((m) => m.key.endsWith(` ${key}`) || m.key.startsWith(`${key} `));
    }
  }
  if (departmentCode) found = found.filter((m) => m.departmentCode === departmentCode);

  if (found.length === 1) return { municipality: withoutKey(found[0]) };
  if (found.length > 1) {
    return {
      candidates: found.map((m) => ({ code: m.code, name: m.name, department: m.department })),
    };
  }
  return {
    error: departmentCode ? `No encontré "${p.city}" en ${DEPARTMENTS[departmentCode]}.` : `No encontré el municipio "${p.city}".`,
  };
}

export function searchMunicipalities(q: string, departmentCode: string | null, limit: number): Municipality[] {
  const key = normalizeText(q);
  return MUNICIPALITIES.filter((m) => (!key || m.key.includes(key)) && (!departmentCode || m.departmentCode === departmentCode))
    .slice(0, limit)
    .map(withoutKey);
}
