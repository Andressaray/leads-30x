// Repositorio de contactos en memoria, con la misma firma que el real (para las pruebas de dominio).
import type { ContactosRepository } from 'modules/contactos/domain/contactos.domain';
import type { CreateInteraccionDTO, InteraccionDTO, LeadContactoDTO, ResultadoRespuesta } from 'modules/contactos/types/contactos.types';

export interface RepositorioContactosEnMemoria extends ContactosRepository {
  _estado: { leads: LeadContactoDTO[]; interacciones: InteraccionDTO[] };
}

const USUARIOS: Record<number, { fullName: string; email: string }> = {
  1: { fullName: 'Andres Saray', email: 'andres@gmail.com' },
  2: { fullName: 'Camila Rojas', email: 'camila@gmail.com' },
  3: { fullName: 'Administrador', email: 'admin@gmail.com' },
};

export function leadDePrueba(p: Partial<LeadContactoDTO> = {}): LeadContactoDTO {
  return {
    id: 1, nombre: 'Café Prueba', municipio: 'SAN JOSÉ DEL GUAVIARE', departamento: 'Guaviare', categorias: ['restaurante'],
    telefonos: [{ numero: '+573001112233', tipo: 'movil', whatsapp: true }, { numero: '+576015550000', tipo: 'fijo' }],
    emails: ['hola@cafe.test'], contactado: false, contactadoEn: null, contactadoPorId: null, contactadoPor: null,
    estadoContacto: 'PENDIENTE', ultimoContactoEn: null, respondioEn: null, noContactar: false, noContactarEn: null,
    calidad: null, puntaje: null, calificadoEn: null, ...p,
  };
}

export function crearRepositorioContactosEnMemoria(leadsIniciales: LeadContactoDTO[] = [leadDePrueba()]): RepositorioContactosEnMemoria {
  const leads = leadsIniciales.map((l) => structuredClone(l));
  const interacciones: InteraccionDTO[] = [];
  let siguienteId = 1;
  const porId = (id: number) => leads.find((l) => l.id === id);

  function crear(dto: CreateInteraccionDTO, fecha: Date): InteraccionDTO {
    const u = dto.usuarioId ? USUARIOS[dto.usuarioId] : undefined;
    const i: InteraccionDTO = { ...dto, id: siguienteId++, usuario: u ? { id: dto.usuarioId!, fullName: u.fullName } : null, createdAt: fecha };
    interacciones.push(i);
    return structuredClone(i);
  }

  const repo = {
    _estado: { leads, interacciones },
    async findLeadContacto(id: number) {
      const l = porId(id);
      if (!l) return null;
      const u = l.contactadoPorId ? USUARIOS[l.contactadoPorId] : undefined;
      return structuredClone({ ...l, contactadoPor: u ? { id: l.contactadoPorId!, ...u } : null });
    },
    async findInteracciones(leadId: number) {
      return interacciones.filter((i) => i.leadId === leadId).reverse().map((i) => structuredClone(i));
    },
    async findSalidasDesde(leadId: number, desde: Date) {
      return interacciones
        .filter((i) => i.leadId === leadId && i.sentido === 'SALIENTE' && i.estado !== 'FALLIDO' && i.createdAt >= desde)
        .reverse()
        .map((i) => ({ canal: i.canal, createdAt: i.createdAt }));
    },
    async createInteraccion(dto: CreateInteraccionDTO) {
      return crear(dto, new Date());
    },
    async guardarSalida(dto: CreateInteraccionDTO, ahora: Date) {
      const l = porId(dto.leadId)!;
      if (!l.contactado && dto.usuarioId) Object.assign(l, { contactado: true, contactadoEn: ahora, contactadoPorId: dto.usuarioId });
      if (l.estadoContacto === 'PENDIENTE') l.estadoContacto = 'CONTACTADO';
      l.ultimoContactoEn = ahora;
      return crear(dto, ahora);
    },
    async guardarRespuesta(dto: CreateInteraccionDTO, resultado: ResultadoRespuesta, ahora: Date) {
      const l = porId(dto.leadId)!;
      l.estadoContacto = resultado;
      if (resultado !== 'REBOTADO' && !l.respondioEn) l.respondioEn = ahora;
      return crear(dto, ahora);
    },
    async marcarNoContactar(dto: CreateInteraccionDTO, ahora: Date) {
      const l = porId(dto.leadId)!;
      if (l.noContactar) return false;
      Object.assign(l, { noContactar: true, noContactarEn: ahora });
      crear(dto, ahora);
      return true;
    },
  };
  return repo as unknown as RepositorioContactosEnMemoria;
}
