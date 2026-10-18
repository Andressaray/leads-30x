// SECOP II source – Proveedores Registrados (datos.gov.co, dataset qmzu-gj57).
// Companies registered to sell to the State, with phone, email and website.
// The "ubicacion" field carries the DIVIPOLA code (e.g. CO-ANT-05615).

import type { Candidate, SourceFilter, LeadSource, Municipality } from '~types/source.types';
import {
  extractHost,
  normalizeDomain,
  normalizeEmails,
  normalizeNit,
  normalizePhones,
  usefulValue,
} from '~utils/normalize';
import { SourceError } from './http';
import { type QuerySocrata } from './socrata';

export const DATASET_SECOP = 'qmzu-gj57';

export interface SecopRecord {
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

export function secopQuery(municipalityCode: string, unspscPrefixes: string[], includeIndividuals: boolean): string {
  if (!/^\d{5}$/.test(municipalityCode)) throw new SourceError('Código de municipio inválido.');
  for (const p of unspscPrefixes) if (!/^\d{2,8}$/.test(p)) throw new SourceError(`Prefijo UNSPSC inválido: ${p}`);
  const parts = [`ubicacion like '%-${municipalityCode}'`, `esta_activa='Si'`];
  if (!includeIndividuals) parts.push(`tipo_empresa not like 'PERSONA NATURAL%'`);
  if (unspscPrefixes.length) {
    parts.push(`(${unspscPrefixes.map((p) => `codigo_categoria_principal like 'V1.${p}%'`).join(' OR ')})`);
  }
  return parts.join(' AND ');
}

export function secopToCandidate(r: SecopRecord, municipality: Municipality): Candidate {
  const nit = normalizeNit(r.nit);
  const name = usefulValue(r.nombre);
  const web = usefulValue(r.sitio_web);
  const websites: string[] = [];
  const socialLinks: string[] = [];
  if (web && extractHost(web)) (normalizeDomain(web) ? websites : socialLinks).push(web.toLowerCase());
  const category = usefulValue(r.descripcion_categoria_principal);
  return {
    source: 'secop',
    externalId: usefulValue(r.codigo) ?? nit ?? `${municipality.code}:${name}`,
    name,
    legalName: name,
    tradeName: null,
    nit,
    municipalityCode: municipality.code,
    address: usefulValue(r.direccion),
    lat: null,
    lon: null,
    ciiu: null,
    sourceCategory: category ? `SECOP ${category}` : null,
    phones: normalizePhones(r.telefono, municipality.departmentCode),
    emails: normalizeEmails([r.correo]),
    websites,
    socialLinks,
    isIndividual: /PERSONA NATURAL/i.test(r.tipo_empresa ?? ''),
    raw: r,
  };
}

export function createSecopSource(query: QuerySocrata): LeadSource {
  return {
    name: 'secop',
    description: 'SECOP II – Proveedores registrados del Estado con teléfono, correo y sitio web',
    async search(municipality: Municipality, filter: SourceFilter, options) {
      const $where = secopQuery(municipality.code, filter.values, options.includeIndividuals);
      const { rows, truncated } = await query<SecopRecord>(DATASET_SECOP, {
        $where,
        $select:
          'codigo, nit, nombre, telefono, correo, sitio_web, direccion, ubicacion, tipo_empresa, esta_activa, codigo_categoria_principal, descripcion_categoria_principal, espyme',
      });
      return { candidates: rows.map((f) => secopToCandidate(f, municipality)), meta: { truncated } };
    },
  };
}
