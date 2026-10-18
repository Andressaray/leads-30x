// REPS source – Registro Especial de Prestadores y Sedes de Servicios de Salud
// (datos.gov.co, dataset c36g-9fc2). One row per site, with phone and email.

import type { Candidate, SourceFilter, LeadSource, Municipality } from '~types/source.types';
import { normalizeEmails, normalizeNit, normalizePhones, usefulValue } from '~utils/normalize';
import { SourceError } from './http';
import { type QuerySocrata } from './socrata';

export const DATASET_REPS = 'c36g-9fc2';

export interface RepsRecord {
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

export function repsQuery(municipalityCode: string, includeIndividuals: boolean): string {
  if (!/^\d{5}$/.test(municipalityCode)) throw new SourceError('Código de municipio inválido.');
  // tipoid: NI = NIT (company); CC, CE, PT = individuals
  return `municipiosede='${municipalityCode}'${includeIndividuals ? '' : ` AND tipoid='NI'`}`;
}

export function repsToCandidate(r: RepsRecord, municipality: Municipality): Candidate {
  const isCompany = r.tipoid === 'NI';
  const site = usefulValue(r.nombresede);
  const provider = usefulValue(r.nombreprestador);
  const className = usefulValue(r.claseprestador);
  return {
    source: 'reps',
    externalId: usefulValue(r.codigohabilitacionsede) ?? `${municipality.code}:${r.numeroidentificacion}:${site}`,
    name: site ?? provider,
    legalName: isCompany ? provider : null,
    tradeName: site,
    nit: isCompany ? normalizeNit(r.numeroidentificacion) : null,
    municipalityCode: usefulValue(r.municipiosede) ?? municipality.code,
    address: usefulValue(r.direcci_nsede),
    lat: null,
    lon: null,
    ciiu: null,
    sourceCategory: className ? `REPS ${className}` : null,
    phones: normalizePhones([r.t_lefonosede, r.telefonoprestador], municipality.departmentCode),
    emails: normalizeEmails([r.email_sede, r.email_prestador]),
    websites: [],
    socialLinks: [],
    isIndividual: !isCompany,
    raw: r,
  };
}

export function createRepsSource(query: QuerySocrata): LeadSource {
  return {
    name: 'reps',
    description: 'REPS – sedes de prestadores de servicios de salud con teléfono y correo',
    async search(municipality: Municipality, _filter: SourceFilter, options) {
      const { rows, truncated } = await query<RepsRecord>(DATASET_REPS, {
        $where: repsQuery(municipality.code, options.includeIndividuals),
      });
      return { candidates: rows.map((f) => repsToCandidate(f, municipality)), meta: { truncated } };
    },
  };
}
