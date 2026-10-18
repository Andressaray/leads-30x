// Lead business rules: deduplication across sources, queries and export.
//
// Matching order of a candidate against what is already stored (in the same municipality):
//   1. Same source + same external id (repeated searches)            → "external_id"
//   2. Same NIT                                                      → "nit"
//   3. Same phone / email / domain, with a compatible name or
//      location (avoids shared numbers)                              → "phone" | "email" | "domain"
//   4. Same street number across different sources, if it is the only one in the
//      municipality (legal name ≠ trade name)                        → "address"
//   5. Similar name + proximity on the map (or, without coordinates,
//      2+ distinctive words in common and a single candidate)        → "name_proximity" | "name"

import * as realRepository from '../repository/leads.repository';
import { AppError, HttpCode } from '~response/index';
import type { Candidate } from '~types/source.types';
import { normalizeAddress } from '~utils/normalize';
import type { LeadsDomainInterface } from './leads.interface';
import {
  SEARCH_RADIUS_DEGREES,
  acceptsByNameWithoutCoordinates,
  acceptsByNameAndDistance,
  candidateKeys,
  buildLead,
  dataToSave,
  repeatedAddressesIn,
  distance,
  merge,
  bestComparison,
  searchWord,
  municipalityWords,
  hasCoordinates,
} from './leads.matching';
import type {
  RecordCountDTO,
  RecordContextDTO,
  SourceStatsDTO,
  LeadFiltersDTO,
  LeadDetailDTO,
  LeadDTO,
  LeadListDTO,
  SearchLeadsSummaryDTO,
} from '../types/leads.types';

export type LeadsRepository = typeof realRepository;

interface Match {
  lead: LeadDTO;
  match: string;
  detail?: Record<string, unknown>;
}

// CSV export: English keys in the code, Spanish headers in the file (the sales team opens it in Excel).
const CSV_HEADERS = {
  id: 'id', name: 'nombre', legal_name: 'razon_social', nit: 'nit', municipality: 'municipio', department: 'departamento',
  municipality_code: 'cod_mpio', address: 'direccion', lat: 'lat', lon: 'lon', ciiu: 'ciiu', source_category: 'categoria_fuente',
  primary_channel: 'canal_principal', primary_phone: 'telefono_principal', phones: 'telefonos', whatsapp: 'whatsapp', emails: 'emails',
  websites: 'sitios_web', social_links: 'redes', contactable: 'contactable', individual: 'persona_natural', sources: 'fuentes',
  origin_source: 'fuente_origen', created_at: 'creado_en', contacted: 'contactado', contacted_by: 'contactado_por',
  contacted_at: 'contactado_en', contact_status: 'estado_contacto', last_contacted_at: 'ultimo_contacto_en',
  do_not_contact: 'no_contactar', quality: 'calidad', score: 'puntaje', qualified_at: 'calificado_en',
} as const;
const CSV_COLUMNS = Object.keys(CSV_HEADERS) as (keyof typeof CSV_HEADERS)[];

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export class LeadsDomain implements LeadsDomainInterface {
  constructor(private readonly repo: LeadsRepository = realRepository) {}

  async list(filters: LeadFiltersDTO): Promise<LeadListDTO> {
    const [total, leads] = await Promise.all([this.repo.countLeads(filters), this.repo.findLeads(filters)]);
    return { total, page: filters.page, limit: filters.limit, leads };
  }

  async get(id: number): Promise<LeadDetailDTO> {
    const lead = await this.repo.findLeadDetail(id);
    if (!lead) throw new AppError(HttpCode.NOT_FOUND, 'Lead no encontrado.');
    return lead;
  }

  async markContacted(id: number, userId: number): Promise<LeadDTO> {
    const assigned = await this.repo.assignContact(id, userId);
    const lead = await this.repo.findLead(id);
    if (!lead) throw new AppError(HttpCode.NOT_FOUND, 'Lead no encontrado.');
    // It was already contacted: if it was the same user nothing happens; if it was someone else, it is not reassigned.
    if (!assigned && lead.contactedById !== userId) {
      const who = lead.contactedBy?.fullName;
      throw new AppError(HttpCode.CONFLICT, who ? `Este lead ya lo contactó ${who}.` : 'Este lead ya fue contactado.', {
        contactedBy: lead.contactedBy ?? null,
        contactedAt: lead.contactedAt ?? null,
      });
    }
    return lead;
  }

  async exportCsv(filters: LeadFiltersDTO): Promise<string> {
    const leads = await this.repo.findLeads(filters);
    const rows = leads.map((l) => {
      const tel = l.phones ?? [];
      const principal = tel.find((t) => t.whatsapp) ?? tel.find((t) => t.type === 'mobile') ?? tel[0];
      const values: Record<keyof typeof CSV_HEADERS, unknown> = {
        id: l.id,
        name: l.name,
        legal_name: l.legalName,
        nit: l.nit,
        municipality: l.municipality,
        department: l.department,
        municipality_code: l.municipalityCode,
        address: l.address,
        lat: l.lat,
        lon: l.lon,
        ciiu: l.ciiu,
        source_category: l.sourceCategory,
        primary_channel: l.primaryChannel,
        primary_phone: principal?.number,
        phones: tel.map((t) => t.number).join(' | '),
        whatsapp: tel.filter((t) => t.whatsapp).map((t) => t.number).join(' | '),
        emails: l.emails.join(' | '),
        websites: l.websites.join(' | '),
        social_links: l.socialLinks.join(' | '),
        contactable: l.contactable ? 'si' : 'no',
        individual: l.isIndividual === null ? '' : l.isIndividual ? 'si' : 'no',
        sources: l.sources.join(','),
        origin_source: l.originSource,
        created_at: l.createdAt,
        contacted: l.contacted ? 'si' : 'no',
        contacted_by: l.contactedBy?.fullName,
        contacted_at: l.contactedAt,
        contact_status: l.contactStatus,
        last_contacted_at: l.lastContactedAt,
        do_not_contact: l.doNotContact ? 'si' : 'no',
        quality: l.quality,
        score: l.score,
        qualified_at: l.qualifiedAt,
      };
      return CSV_COLUMNS.map((c) => csvCell(values[c])).join(',');
    });
    return `﻿${CSV_COLUMNS.map((c) => CSV_HEADERS[c]).join(',')}\n${rows.join('\n')}${rows.length ? '\n' : ''}`;
  }

  async registerCandidates(candidates: Candidate[], ctx: RecordContextDTO): Promise<RecordCountDTO> {
    const count: RecordCountDTO = { records: candidates.length, new: 0, enriched: 0, unchanged: 0, skipped: 0 };
    const ignore = municipalityWords(ctx.municipality);
    const repeated = repeatedAddressesIn(candidates);

    // Sequential on purpose: each candidate must see what the previous one stored.
    for (const cand of candidates) {
      if (!cand.name && !cand.legalName) {
        count.skipped += 1;
        continue;
      }
      const found = await this.findMatch(cand, ignore, repeated);
      let leadId: number;
      let result: 'new' | 'enriched' | 'unchanged';
      if (!found) {
        const created = await this.repo.createLead(buildLead(cand, ctx));
        leadId = created.id;
        result = 'new';
        count.new += 1;
      } else {
        const { lead, change } = merge(found.lead, cand, ctx.category);
        leadId = lead.id;
        if (change) {
          const { id: _id, createdAt: _c, updatedAt: _u, ...data } = lead;
          await this.repo.updateLead(lead.id, data);
          result = 'enriched';
          count.enriched += 1;
        } else {
          result = 'unchanged';
          count.unchanged += 1;
        }
      }
      await this.repo.createKeys(leadId, candidateKeys(cand));
      await this.repo.upsertOccurrence({
        leadId,
        source: cand.source,
        externalId: cand.externalId,
        match: found ? found.match : 'new',
        data: dataToSave(cand),
        searchId: ctx.searchId,
      });
      await this.repo.createSearchLead(ctx.searchId, leadId, cand.source, result);
    }
    return count;
  }

  async searchSummary(searchId: number): Promise<SearchLeadsSummaryDTO> {
    const [leads, newCount, contactables, inMultipleSources] = await Promise.all([
      this.repo.countLeads({ searchId }),
      this.repo.countNewLeadsOfSearch(searchId),
      this.repo.countLeads({ searchId, contactable: true }),
      this.repo.countLeads({ searchId, inBoth: true }),
    ]);
    return { leads, new: newCount, contactables, inMultipleSources };
  }

  async stats(): Promise<SourceStatsDTO[]> {
    return this.repo.findStatsBySource();
  }

  /** Looks for an existing lead that is the same business as the candidate. */
  async findMatch(cand: Candidate, ignore?: Set<string>, repeatedAddresses?: Set<string>): Promise<Match | null> {
    // 1. Repeated search
    const previous = await this.repo.findLeadByOccurrence(cand.source, cand.externalId);
    if (previous) return { lead: previous, match: 'external_id' };

    // 2 and 3. Strong keys
    for (const { type, value } of candidateKeys(cand)) {
      const lead = await this.repo.findLeadByKey(type, value);
      if (!lead) continue;
      if (type === 'nit') return { lead, match: 'nit' };
      if (cand.nit && lead.nit && cand.nit !== lead.nit) continue;
      const cmp = bestComparison(cand, lead, ignore);
      const meters = distance(cand, lead);
      if (cmp.common >= 1 || meters <= 200) {
        return { lead, match: type, detail: { score: cmp.score, meters: Number.isFinite(meters) ? Math.round(meters) : null } };
      }
    }

    // 4. Same street number across different sources
    const plate = normalizeAddress(cand.address);
    if (plate && !repeatedAddresses?.has(`${cand.source}|${plate}`)) {
      const others = await this.repo.findLeadsByAddress(cand.municipalityCode, plate);
      const fromOtherSource = others.filter((l) => !l.sources.includes(cand.source));
      if (others.length === 1 && fromOtherSource.length === 1) {
        const lead = fromOtherSource[0];
        const meters = distance(cand, lead);
        const nitCompatible = !(cand.nit && lead.nit && cand.nit !== lead.nit);
        if (nitCompatible && (!Number.isFinite(meters) || meters <= 150)) {
          return { lead, match: 'address', detail: { plate } };
        }
      }
    }

    // 5. Name (+ distance when there are coordinates)
    return hasCoordinates(cand) ? this.byNameAndDistance(cand, ignore) : this.byNameWithoutCoordinates(cand, ignore);
  }

  private canMergeByName(cand: Candidate, lead: LeadDTO): boolean {
    if (cand.nit && lead.nit && cand.nit !== lead.nit) return false;
    if (!lead.sources.includes(cand.source)) return true;
    // Within a single source, only OSM has duplicates (the place as a point and as a building).
    return cand.source === 'osm';
  }

  private async byNameAndDistance(cand: Candidate, ignore?: Set<string>): Promise<Match | null> {
    const nearby = await this.repo.findNearbyLeads(cand.municipalityCode, cand.lat!, cand.lon!, SEARCH_RADIUS_DEGREES);
    let best: { lead: LeadDTO; score: number; meters: number } | null = null;
    for (const lead of nearby) {
      if (!this.canMergeByName(cand, lead)) continue;
      const cmp = bestComparison(cand, lead, ignore);
      const meters = distance(cand, lead);
      const accepts = lead.sources.includes(cand.source) ? cmp.score >= 0.9 && meters <= 50 : acceptsByNameAndDistance(cmp, meters);
      if (!accepts) continue;
      if (!best || cmp.score > best.score || (cmp.score === best.score && meters < best.meters)) {
        best = { lead, score: cmp.score, meters };
      }
    }
    if (!best) return null;
    return {
      lead: best.lead,
      match: 'name_proximity',
      detail: { score: Number(best.score.toFixed(2)), meters: Math.round(best.meters) },
    };
  }

  private async byNameWithoutCoordinates(cand: Candidate, ignore?: Set<string>): Promise<Match | null> {
    const word = searchWord(cand, ignore);
    if (!word) return null;
    const possibleMatches = await this.repo.findLeadsByWord(cand.municipalityCode, word);
    const accepted = possibleMatches.filter(
      (l) => !l.sources.includes(cand.source) && this.canMergeByName(cand, l) && acceptsByNameWithoutCoordinates(bestComparison(cand, l, ignore))
    );
    // If more than one is equally similar, there is no way to tell which one it is.
    if (accepted.length !== 1) return null;
    return { lead: accepted[0], match: 'name', detail: { word } };
  }
}
