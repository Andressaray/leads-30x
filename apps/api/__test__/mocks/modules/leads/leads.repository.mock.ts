// Repositorio de leads en memoria, con la misma firma que el real.
// Lo usan las pruebas de dominio para ejercitar las reglas de cruce sin base de datos.

import type { NombreFuente } from '~types/fuente.types';
import type { LeadsRepository } from 'modules/leads/domain/leads.domain';
import type {
  AparicionDTO,
  ClaveDTO,
  CreateLeadDTO,
  FiltrosLeadsDTO,
  LeadDTO,
  ResultadoRegistroLead,
  UpdateLeadDTO,
} from 'modules/leads/types/leads.types';

interface Aparicion extends AparicionDTO {
  leadId: number;
}

export interface RepositorioLeadsEnMemoria extends LeadsRepository {
  _estado: {
    leads: LeadDTO[];
    claves: Map<string, number>;
    apariciones: Aparicion[];
    busquedaLeads: { busquedaId: number; leadId: number; fuente: NombreFuente; resultado: ResultadoRegistroLead }[];
  };
}

export function crearRepositorioLeadsEnMemoria(): RepositorioLeadsEnMemoria {
  const leads: LeadDTO[] = [];
  const claves = new Map<string, number>();
  const apariciones: Aparicion[] = [];
  const busquedaLeads: RepositorioLeadsEnMemoria['_estado']['busquedaLeads'] = [];
  let siguienteId = 1;
  // Usuarios conocidos (para devolver contactadoPor como lo haría el include de Prisma).
  const usuarios = new Map<number, { fullName: string; email: string }>([
    [1, { fullName: 'Andres Saray', email: 'andres@gmail.com' }],
    [2, { fullName: 'Camila Rojas', email: 'camila@gmail.com' }],
  ]);

  const copia = (l: LeadDTO): LeadDTO => structuredClone(l);
  const porId = (id: number) => leads.find((l) => l.id === id);

  function cumple(l: LeadDTO, f: Partial<FiltrosLeadsDTO>): boolean {
    if (f.busquedaId && !busquedaLeads.some((b) => b.busquedaId === f.busquedaId && b.leadId === l.id)) return false;
    if (f.codMpio && l.codMpio !== f.codMpio) return false;
    if (f.codDpto && !l.codMpio.startsWith(f.codDpto)) return false;
    if (f.categoria && !l.categorias.includes(f.categoria)) return false;
    if (f.fuente && !l.fuentes.includes(f.fuente)) return false;
    if (f.contactable !== undefined && l.contactable !== f.contactable) return false;
    if (f.contactado !== undefined && l.contactado !== f.contactado) return false;
    if (f.contactadoPorId !== undefined && l.contactadoPorId !== f.contactadoPorId) return false;
    if (f.estados?.length && !f.estados.includes(l.estadoContacto ?? 'PENDIENTE')) return false;
    if (f.calidades?.length && !f.calidades.includes(l.calidad ?? 'SIN')) return false;
    if (f.enAmbas && l.numFuentes <= 1) return false;
    if (f.personasNaturales === false && l.esPersonaNatural === true) return false;
    if (f.personasNaturales === true && l.esPersonaNatural !== true) return false;
    if (f.q && !(l.nombre.toLowerCase().includes(f.q.toLowerCase()) || l.nit === f.q)) return false;
    return true;
  }

  const repo = {
    _estado: { leads, claves, apariciones, busquedaLeads },

    async findLeadByAparicion(fuente: NombreFuente, idExterno: string) {
      const a = apariciones.find((x) => x.fuente === fuente && x.idExterno === idExterno);
      const l = a && porId(a.leadId);
      return l ? copia(l) : null;
    },
    async findLeadByClave(tipo: string, valor: string) {
      const id = claves.get(`${tipo}|${valor}`);
      const l = id !== undefined ? porId(id) : undefined;
      return l ? copia(l) : null;
    },
    async findLeadsCercanos(codMpio: string, lat: number, lon: number, delta: number) {
      return leads
        .filter((l) => l.codMpio === codMpio && l.lat !== null && l.lon !== null && Math.abs(l.lat - lat) <= delta && Math.abs(l.lon - lon) <= delta)
        .map(copia);
    },
    async findLeadsPorDireccion(codMpio: string, direccionNorm: string) {
      return leads.filter((l) => l.codMpio === codMpio && l.direccionNorm === direccionNorm).map(copia);
    },
    async findLeadsPorPalabra(codMpio: string, palabra: string) {
      return leads.filter((l) => l.codMpio === codMpio && l.nombresNorm.includes(palabra)).map(copia);
    },
    async createLead(dto: CreateLeadDTO) {
      const ahora = new Date();
      const lead: LeadDTO = {
        ...structuredClone(dto),
        contactado: dto.contactado ?? false,
        contactadoEn: dto.contactadoEn ?? null,
        contactadoPorId: dto.contactadoPorId ?? null,
        id: siguienteId++,
        createdAt: ahora,
        updatedAt: ahora,
      };
      leads.push(lead);
      return copia(lead);
    },
    async updateLead(id: number, dto: UpdateLeadDTO) {
      const l = porId(id);
      if (!l) throw new Error(`lead ${id} no existe`);
      Object.assign(l, structuredClone(dto), { updatedAt: new Date() });
      return copia(l);
    },
    async asignarContacto(id: number, usuarioId: number) {
      const l = porId(id);
      if (!l || l.contactado) return false;
      Object.assign(l, { contactado: true, contactadoEn: new Date(), contactadoPorId: usuarioId, updatedAt: new Date() });
      return true;
    },
    async findLead(id: number) {
      const l = porId(id);
      if (!l) return null;
      const u = l.contactadoPorId ? usuarios.get(l.contactadoPorId) : undefined;
      return { ...copia(l), contactadoPor: u ? { id: l.contactadoPorId!, ...u } : null };
    },
    async createClaves(leadId: number, lista: ClaveDTO[]) {
      let n = 0;
      for (const c of lista) {
        const k = `${c.tipo}|${c.valor}`;
        if (!claves.has(k)) {
          claves.set(k, leadId);
          n += 1;
        }
      }
      return n;
    },
    async upsertAparicion(a: { leadId: number; fuente: NombreFuente; idExterno: string; coincidencia: string; datos: unknown; busquedaId: number }) {
      const existente = apariciones.find((x) => x.fuente === a.fuente && x.idExterno === a.idExterno);
      if (existente) {
        Object.assign(existente, { datos: a.datos, busquedaId: a.busquedaId, ultimaVez: new Date() });
      } else {
        apariciones.push({ ...a, primeraVez: new Date(), ultimaVez: new Date() });
      }
    },
    async createBusquedaLead(busquedaId: number, leadId: number, fuente: NombreFuente, resultado: ResultadoRegistroLead) {
      if (!busquedaLeads.some((b) => b.busquedaId === busquedaId && b.leadId === leadId && b.fuente === fuente)) {
        busquedaLeads.push({ busquedaId, leadId, fuente, resultado });
      }
    },
    async countLeads(f: Partial<FiltrosLeadsDTO>) {
      return leads.filter((l) => cumple(l, f)).length;
    },
    async findLeads(f: FiltrosLeadsDTO) {
      return leads
        .filter((l) => cumple(l, f))
        .sort((a, b) => Number(b.contactable) - Number(a.contactable) || b.numFuentes - a.numFuentes || a.id - b.id)
        .slice((f.pagina - 1) * f.limite, f.pagina * f.limite)
        .map(copia);
    },
    async countLeadsNuevosDeBusqueda(busquedaId: number) {
      return new Set(busquedaLeads.filter((b) => b.busquedaId === busquedaId && b.resultado === 'nuevo').map((b) => b.leadId)).size;
    },
    async findLeadDetalle(id: number) {
      const l = porId(id);
      if (!l) return null;
      return { ...copia(l), apariciones: apariciones.filter((a) => a.leadId === id).map(({ leadId: _l, ...a }) => a) };
    },
    async findEstadisticasPorFuente() {
      const porFuente = new Map<string, Set<number>>();
      for (const a of apariciones) {
        if (!porFuente.has(a.fuente)) porFuente.set(a.fuente, new Set());
        porFuente.get(a.fuente)!.add(a.leadId);
      }
      return [...porFuente].map(([fuente, ids]) => {
        const ls = [...ids].map(porId).filter((l): l is LeadDTO => Boolean(l));
        return { fuente, leads: ls.length, contactables: ls.filter((l) => l.contactable).length, atribuidos: ls.filter((l) => l.fuenteOrigen === fuente).length };
      });
    },
  };
  return repo as unknown as RepositorioLeadsEnMemoria;
}
