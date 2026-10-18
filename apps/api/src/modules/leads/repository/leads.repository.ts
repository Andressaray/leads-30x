// Acceso a datos de leads. Una función por consulta, sin reglas de negocio.

import { prisma, type Prisma } from '~config/db/client';
import type { NombreFuente, Telefono } from '~types/fuente.types';
import type {
  AparicionDTO,
  ClaveDTO,
  ContactadoPorDTO,
  CreateLeadDTO,
  EstadisticaFuenteDTO,
  FiltrosLeadsDTO,
  LeadDetalleDTO,
  LeadDTO,
  ResultadoRegistroLead,
  UpdateLeadDTO,
} from '../types/leads.types';

type FilaLead = Prisma.LeadGetPayload<object> & { contactadoPor?: ContactadoPorDTO | null };

/** Quién contactó el lead: solo los datos públicos del usuario. */
const CON_CONTACTADO_POR = { contactadoPor: { select: { id: true, fullName: true, email: true } } } as const;

function aLeadDTO(f: FilaLead): LeadDTO {
  return {
    ...f,
    telefonos: (f.telefonos as unknown as Telefono[]) ?? [],
    categorias: f.categorias ?? [],
    emails: f.emails ?? [],
    sitiosWeb: f.sitiosWeb ?? [],
    redes: f.redes ?? [],
    fuentes: (f.fuentes ?? []) as NombreFuente[],
    fuenteOrigen: f.fuenteOrigen as NombreFuente,
    canalPrincipal: f.canalPrincipal as LeadDTO['canalPrincipal'],
  };
}

function aDatos(dto: UpdateLeadDTO): Prisma.LeadUncheckedUpdateInput {
  // El estado de contacto solo lo cambia asignarContacto: una búsqueda que enriquece el lead
  // no debe pisarlo con datos leídos antes de que alguien le diera "Contactar".
  const {
    telefonos,
    contactado: _c,
    contactadoEn: _e,
    contactadoPorId: _p,
    contactadoPor: _u,
    estadoContacto: _ec,
    ultimoContactoEn: _uc,
    respondioEn: _r,
    noContactar: _n,
    calidad: _ca,
    puntaje: _pu,
    calificadoEn: _cf,
    ...resto
  } = dto as UpdateLeadDTO & Pick<LeadDTO, 'contactadoPor'>;
  return { ...resto, ...(telefonos !== undefined ? { telefonos: telefonos as unknown as Prisma.InputJsonValue } : {}) };
}

function construirWhere(f: Partial<FiltrosLeadsDTO>): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};
  const and: Prisma.LeadWhereInput[] = [];
  if (f.busquedaId) where.busquedas = { some: { busquedaId: f.busquedaId } };
  if (f.codMpio) where.codMpio = f.codMpio;
  if (f.codDpto && !f.codMpio) where.codMpio = { startsWith: f.codDpto };
  if (f.categoria) where.categorias = { has: f.categoria };
  if (f.fuente) where.fuentes = { has: f.fuente };
  if (f.contactable !== undefined) where.contactable = f.contactable;
  if (f.contactado !== undefined) where.contactado = f.contactado;
  if (f.contactadoPorId !== undefined) where.contactadoPorId = f.contactadoPorId;
  if (f.estados?.length) where.estadoContacto = { in: f.estados };
  if (f.calidades?.length) {
    const reales = f.calidades.filter((c) => c !== 'SIN') as ('ALTA' | 'MEDIA' | 'BAJA' | 'DESCARTADO')[];
    and.push({ OR: [...(reales.length ? [{ calidad: { in: reales } }] : []), ...(f.calidades.includes('SIN') ? [{ calidad: null }] : [])] });
  }
  if (f.enAmbas) where.numFuentes = { gt: 1 };
  if (f.personasNaturales === false) and.push({ OR: [{ esPersonaNatural: false }, { esPersonaNatural: null }] });
  if (f.personasNaturales === true) where.esPersonaNatural = true;
  if (f.q) {
    and.push({
      OR: [
        { nombre: { contains: f.q, mode: 'insensitive' } },
        { razonSocial: { contains: f.q, mode: 'insensitive' } },
        { nombresNorm: { contains: f.q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() } },
        { nit: f.q },
      ],
    });
  }
  if (and.length) where.AND = and;
  return where;
}

export async function findLeadByAparicion(fuente: NombreFuente, idExterno: string): Promise<LeadDTO | null> {
  const aparicion = await prisma.aparicion.findUnique({
    where: { fuente_idExterno: { fuente, idExterno } },
    include: { lead: true },
  });
  return aparicion ? aLeadDTO(aparicion.lead) : null;
}

export async function findLeadByClave(tipo: string, valor: string): Promise<LeadDTO | null> {
  const clave = await prisma.leadClave.findUnique({ where: { tipo_valor: { tipo, valor } }, include: { lead: true } });
  return clave ? aLeadDTO(clave.lead) : null;
}

export async function findLeadsCercanos(codMpio: string, lat: number, lon: number, delta: number): Promise<LeadDTO[]> {
  const filas = await prisma.lead.findMany({
    where: { codMpio, lat: { gte: lat - delta, lte: lat + delta }, lon: { gte: lon - delta, lte: lon + delta } },
  });
  return filas.map(aLeadDTO);
}

export async function findLeadsPorDireccion(codMpio: string, direccionNorm: string): Promise<LeadDTO[]> {
  const filas = await prisma.lead.findMany({ where: { codMpio, direccionNorm } });
  return filas.map(aLeadDTO);
}

/** Leads del municipio cuyo nombre o razón social contiene la palabra (para cruzar fuentes sin coordenadas). */
export async function findLeadsPorPalabra(codMpio: string, palabra: string, limite = 50): Promise<LeadDTO[]> {
  const filas = await prisma.lead.findMany({
    where: { codMpio, nombresNorm: { contains: palabra } },
    take: limite,
  });
  return filas.map(aLeadDTO);
}

export async function createLead(dto: CreateLeadDTO): Promise<LeadDTO> {
  const fila = await prisma.lead.create({
    data: { ...dto, telefonos: dto.telefonos as unknown as Prisma.InputJsonValue },
  });
  return aLeadDTO(fila);
}

export async function updateLead(id: number, dto: UpdateLeadDTO): Promise<LeadDTO> {
  const fila = await prisma.lead.update({ where: { id }, data: aDatos(dto) });
  return aLeadDTO(fila);
}

/**
 * Asigna el lead al usuario solo si nadie lo ha contactado todavía (en una sola sentencia,
 * así dos personas que le dan "Contactar" a la vez no se pisan). true si quedó asignado.
 */
export async function asignarContacto(id: number, usuarioId: number): Promise<boolean> {
  const r = await prisma.lead.updateMany({
    where: { id, contactado: false },
    data: { contactado: true, contactadoEn: new Date(), contactadoPorId: usuarioId },
  });
  if (r.count === 1) {
    // Contactado por fuera de la plataforma: entra al embudo como CONTACTADO.
    await prisma.lead.updateMany({ where: { id, estadoContacto: 'PENDIENTE' }, data: { estadoContacto: 'CONTACTADO', ultimoContactoEn: new Date() } });
  }
  return r.count === 1;
}

export async function findLead(id: number): Promise<LeadDTO | null> {
  const fila = await prisma.lead.findUnique({ where: { id }, include: CON_CONTACTADO_POR });
  return fila ? aLeadDTO(fila) : null;
}

export async function createClaves(leadId: number, claves: ClaveDTO[]): Promise<number> {
  if (!claves.length) return 0;
  const r = await prisma.leadClave.createMany({
    data: claves.map((c) => ({ ...c, leadId })),
    skipDuplicates: true,
  });
  return r.count;
}

export async function upsertAparicion(a: {
  leadId: number;
  fuente: NombreFuente;
  idExterno: string;
  coincidencia: string;
  datos: unknown;
  busquedaId: number;
}): Promise<void> {
  const datos = (a.datos ?? null) as Prisma.InputJsonValue;
  await prisma.aparicion.upsert({
    where: { fuente_idExterno: { fuente: a.fuente, idExterno: a.idExterno } },
    create: { leadId: a.leadId, fuente: a.fuente, idExterno: a.idExterno, coincidencia: a.coincidencia, datos, busquedaId: a.busquedaId },
    update: { datos, busquedaId: a.busquedaId },
  });
}

export async function createBusquedaLead(busquedaId: number, leadId: number, fuente: NombreFuente, resultado: ResultadoRegistroLead): Promise<void> {
  await prisma.busquedaLead.createMany({ data: [{ busquedaId, leadId, fuente, resultado }], skipDuplicates: true });
}

export async function countLeads(filtros: Partial<FiltrosLeadsDTO>): Promise<number> {
  return prisma.lead.count({ where: construirWhere(filtros) });
}

export async function findLeads(filtros: FiltrosLeadsDTO): Promise<LeadDTO[]> {
  // En la lista de contactados, primero los más recientes.
  const orden: Prisma.LeadOrderByWithRelationInput[] =
    filtros.contactado === true
      ? [{ contactadoEn: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }]
      : [{ contactable: 'desc' }, { numFuentes: 'desc' }, { id: 'asc' }];
  const filas = await prisma.lead.findMany({
    where: construirWhere(filtros),
    include: CON_CONTACTADO_POR,
    orderBy: orden,
    skip: (filtros.pagina - 1) * filtros.limite,
    take: filtros.limite,
  });
  return filas.map(aLeadDTO);
}

export async function countLeadsNuevosDeBusqueda(busquedaId: number): Promise<number> {
  return prisma.lead.count({ where: { busquedas: { some: { busquedaId, resultado: 'nuevo' } } } });
}

export async function findLeadDetalle(id: number): Promise<LeadDetalleDTO | null> {
  const fila = await prisma.lead.findUnique({ where: { id }, include: { ...CON_CONTACTADO_POR, apariciones: { orderBy: { createdAt: 'asc' } } } });
  if (!fila) return null;
  const { apariciones, ...lead } = fila;
  return {
    ...aLeadDTO(lead),
    apariciones: apariciones.map(
      (a): AparicionDTO => ({
        fuente: a.fuente as NombreFuente,
        idExterno: a.idExterno,
        coincidencia: a.coincidencia,
        datos: a.datos,
        busquedaId: a.busquedaId,
        primeraVez: a.createdAt,
        ultimaVez: a.updatedAt,
      })
    ),
  };
}

export async function findEstadisticasPorFuente(): Promise<EstadisticaFuenteDTO[]> {
  const filas = await prisma.$queryRaw<{ fuente: string; leads: bigint; contactables: bigint; atribuidos: bigint }[]>`
    SELECT a.fuente,
           COUNT(DISTINCT a.lead_id) AS leads,
           COUNT(DISTINCT CASE WHEN l.contactable THEN l.id END) AS contactables,
           COUNT(DISTINCT CASE WHEN l.fuente_origen = a.fuente THEN l.id END) AS atribuidos
    FROM apariciones a JOIN leads l ON l.id = a.lead_id
    GROUP BY a.fuente ORDER BY a.fuente`;
  return filas.map((f) => ({ fuente: f.fuente, leads: Number(f.leads), contactables: Number(f.contactables), atribuidos: Number(f.atribuidos) }));
}
