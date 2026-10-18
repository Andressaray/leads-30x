// Repositorio de calificaciones en memoria (pruebas de dominio).
import type { CalificacionesRepository } from 'modules/calificaciones/domain/calificaciones.domain';
import type { CalificacionDTO, CreateCalificacionDTO, LeadParaDaptaDTO, ResultadoCalificacionDTO } from 'modules/calificaciones/types/calificaciones.types';

export interface RepositorioCalificacionesEnMemoria extends CalificacionesRepository {
  _estado: { leads: (LeadParaDaptaDTO & { calidad?: string | null; puntaje?: number | null })[]; calificaciones: CalificacionDTO[] };
}

export function leadParaDapta(p: Partial<LeadParaDaptaDTO> = {}): LeadParaDaptaDTO {
  return {
    id: 1, nombre: 'Café Prueba', municipio: 'RIONEGRO', departamento: 'Antioquia', categorias: ['restaurante'],
    telefonos: [{ numero: '+576045550000', tipo: 'fijo' }, { numero: '+573001112233', tipo: 'movil' }], emails: ['hola@cafe.test'],
    fuenteOrigen: 'osm', estadoContacto: 'PENDIENTE', noContactar: false, contactadoPorId: null, contactadoPor: null, ...p,
  };
}

export function crearRepositorioCalificacionesEnMemoria(leadsIniciales = [leadParaDapta()]): RepositorioCalificacionesEnMemoria {
  const leads = leadsIniciales.map((l) => ({ ...structuredClone(l), calidad: null as string | null, puntaje: null as number | null }));
  const calificaciones: CalificacionDTO[] = [];
  let id = 1;
  const crear = (dto: CreateCalificacionDTO): CalificacionDTO => {
    const c = { ...structuredClone(dto), id: id++, createdAt: new Date(Date.now() + id) };
    calificaciones.push(c);
    return structuredClone(c);
  };
  const repo = {
    _estado: { leads, calificaciones },
    async findLeadParaDapta(leadId: number) {
      const l = leads.find((x) => x.id === leadId);
      return l ? structuredClone(l) : null;
    },
    async findCalificaciones(leadId: number) {
      return calificaciones.filter((c) => c.leadId === leadId).reverse().map((c) => structuredClone(c));
    },
    async findCalificacionPorReferencia(referencia: string) {
      const c = calificaciones.find((x) => x.referencia === referencia);
      return c ? structuredClone(c) : null;
    },
    async findEnvioPendiente(leadId: number, desde?: Date) {
      const c = [...calificaciones].reverse().find(
        (x) => x.leadId === leadId && x.origen === 'DAPTA' && ['ENVIADO', 'SIMULADO'].includes(x.estado) && (!desde || x.createdAt >= desde)
      );
      return c ? structuredClone(c) : null;
    },
    async createCalificacion(dto: CreateCalificacionDTO) {
      return crear(dto);
    },
    async guardarResultado(cid: number, r: ResultadoCalificacionDTO) {
      const c = calificaciones.find((x) => x.id === cid)!;
      Object.assign(c, structuredClone(r));
      if (r.estado === 'CALIFICADO' && r.calidad) Object.assign(leads.find((l) => l.id === c.leadId)!, { calidad: r.calidad, puntaje: r.puntaje });
      return structuredClone(c);
    },
    async crearCalificacionManual(dto: CreateCalificacionDTO) {
      Object.assign(leads.find((l) => l.id === dto.leadId)!, { calidad: dto.calidad, puntaje: dto.puntaje });
      return crear(dto);
    },
  };
  return repo as unknown as RepositorioCalificacionesEnMemoria;
}
