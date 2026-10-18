// Acceso a datos de búsquedas. Una función por consulta, sin reglas de negocio.

import { prisma, type Prisma } from '~config/db/client';
import type { FiltrosBusqueda, NombreFuente } from '~types/fuente.types';
import type { BusquedaDTO, BusquedaFuenteDTO, CreateBusquedaDTO, EstadoBusqueda, ResumenBusquedaDTO } from '../types/busquedas.types';

type FilaBusqueda = Prisma.BusquedaGetPayload<{ include: { fuentes: true } }> | Prisma.BusquedaGetPayload<object>;
type FilaFuente = Prisma.BusquedaFuenteGetPayload<object>;

function aFuenteDTO(f: FilaFuente): BusquedaFuenteDTO {
  return {
    fuente: f.fuente as NombreFuente,
    estado: f.estado as BusquedaFuenteDTO['estado'],
    registros: f.registros,
    nuevos: f.nuevos,
    enriquecidos: f.enriquecidos,
    sinCambios: f.sinCambios,
    omitidos: f.omitidos,
    duracionMs: f.duracionMs,
    error: f.error,
    meta: (f.meta as Record<string, unknown> | null) ?? null,
  };
}

function aBusquedaDTO(b: FilaBusqueda): BusquedaDTO {
  const { fuentes, ...resto } = b as FilaBusqueda & { fuentes?: FilaFuente[] };
  return {
    ...resto,
    filtros: resto.filtros as unknown as FiltrosBusqueda,
    fuentesPedidas: (resto.fuentesPedidas ?? []) as NombreFuente[],
    estado: resto.estado as EstadoBusqueda,
    resumen: (resto.resumen as unknown as ResumenBusquedaDTO | null) ?? null,
    ...(fuentes ? { fuentes: fuentes.map(aFuenteDTO) } : {}),
  };
}

export async function createBusqueda(dto: CreateBusquedaDTO): Promise<BusquedaDTO> {
  const fila = await prisma.busqueda.create({
    data: { ...dto, filtros: dto.filtros as unknown as Prisma.InputJsonValue },
  });
  return aBusquedaDTO(fila);
}

export async function upsertBusquedaFuente(busquedaId: number, f: BusquedaFuenteDTO): Promise<void> {
  const datos = { ...f, meta: (f.meta ?? undefined) as Prisma.InputJsonValue | undefined };
  await prisma.busquedaFuente.upsert({
    where: { busquedaId_fuente: { busquedaId, fuente: f.fuente } },
    create: { busquedaId, ...datos },
    update: datos,
  });
}

export async function updateBusqueda(id: number, datos: { estado: EstadoBusqueda; resumen: ResumenBusquedaDTO; terminadoEn: Date }): Promise<BusquedaDTO> {
  const fila = await prisma.busqueda.update({
    where: { id },
    data: { ...datos, resumen: datos.resumen as unknown as Prisma.InputJsonValue },
  });
  return aBusquedaDTO(fila);
}

export async function findBusquedas(limite: number): Promise<BusquedaDTO[]> {
  const filas = await prisma.busqueda.findMany({ orderBy: { id: 'desc' }, take: limite });
  return filas.map(aBusquedaDTO);
}

export async function findBusquedaById(id: number): Promise<BusquedaDTO | null> {
  const fila = await prisma.busqueda.findUnique({ where: { id }, include: { fuentes: { orderBy: { fuente: 'asc' } } } });
  return fila ? aBusquedaDTO(fila) : null;
}

/** Al arrancar: las búsquedas que quedaron "en_curso" (el servidor se detuvo a mitad) pasan a "fallida". */
export async function cerrarBusquedasInconclusas(): Promise<number> {
  const r = await prisma.busqueda.updateMany({ where: { estado: 'en_curso' }, data: { estado: 'fallida', terminadoEn: new Date() } });
  return r.count;
}
