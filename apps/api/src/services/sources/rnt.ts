// RNT source – Registro Nacional de Turismo (datos.gov.co, dataset thwd-ivmp).
// Active tourism providers with NIT, address, mobile, phone and email.
// It has no coordinates: it is matched by NIT, phone, email or address.

import type { Candidate, SourceFilter, LeadSource, Municipality } from '~types/source.types';
import { normalizeEmails, normalizeNit, normalizePhones, looksLikeCompanyNit, usefulValue } from '~utils/normalize';
import { SourceError } from './http';
import { literalSoql, type QuerySocrata } from './socrata';

export const DATASET_RNT = 'thwd-ivmp';

export interface RntRecord {
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

export function rntQuery(municipalityCode: string, categories: string[]): string {
  if (!/^\d{5}$/.test(municipalityCode)) throw new SourceError('Código de municipio inválido.');
  const parts = [`cod_mun=${literalSoql(municipalityCode)}`, `estado_rnt='ACTIVO'`];
  if (categories.length) parts.push(`categoria in (${categories.map(literalSoql).join(', ')})`);
  return parts.join(' AND ');
}

export function rntToCandidate(r: RntRecord, municipality: Municipality): Candidate {
  const nit = normalizeNit(r.nit);
  const name = usefulValue(r.razon_social_establecimiento);
  const sub = usefulValue(r.sub_categoria) ?? usefulValue(r.categoria);
  return {
    source: 'rnt',
    externalId: usefulValue(r.codigo_rnt) ?? `${municipality.code}:${nit}:${name}`,
    name,
    legalName: null,
    tradeName: name,
    nit,
    municipalityCode: usefulValue(r.cod_mun) ?? municipality.code,
    address: usefulValue(r.direcci_n_comercial_establecimiento),
    lat: null,
    lon: null,
    ciiu: null,
    sourceCategory: sub ? `RNT ${sub}` : null,
    phones: normalizePhones([r.num_celular, r.n_m_tel_fono], municipality.departmentCode),
    emails: normalizeEmails([r.correo_establecimiento, r.correo_prestador]),
    websites: [],
    socialLinks: [],
    isIndividual: !looksLikeCompanyNit(nit),
    raw: r,
  };
}

export function createRntSource(query: QuerySocrata): LeadSource {
  return {
    name: 'rnt',
    description: 'Registro Nacional de Turismo – prestadores turísticos activos con correo y teléfono',
    async search(municipality: Municipality, filter: SourceFilter, options) {
      const { rows, truncated } = await query<RntRecord>(DATASET_RNT, { $where: rntQuery(municipality.code, filter.values) });
      const all = rows.map((f) => rntToCandidate(f, municipality));
      // The RNT does not say whether it is an individual; a company NIT has 9 digits and starts with 8 or 9.
      const candidates = options.includeIndividuals ? all : all.filter((c) => !c.isIndividual);
      return { candidates, meta: { skipped_individuals: all.length - candidates.length, truncated } };
    },
  };
}
