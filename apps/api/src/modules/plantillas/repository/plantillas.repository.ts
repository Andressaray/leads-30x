// Acceso a datos de plantillas. Una función por consulta, sin reglas de negocio.
import { prisma } from '~config/db/client';
import type { CreatePlantillaDTO, FiltrosPlantillasDTO, PlantillaDTO, UpdatePlantillaDTO } from '../types/plantillas.types';

const CON_AUTOR = { creadoPor: { select: { id: true, fullName: true } } } as const;

type Fila = Omit<PlantillaDTO, 'canal'> & { canal: string };
const aDTO = (f: Fila): PlantillaDTO => ({ ...f, canal: f.canal as PlantillaDTO['canal'] });

export async function findPlantillas(f: FiltrosPlantillasDTO): Promise<PlantillaDTO[]> {
  const filas = await prisma.plantilla.findMany({
    where: { ...(f.canal ? { canal: f.canal } : {}), ...(f.incluirInactivas ? {} : { activa: true }) },
    include: CON_AUTOR,
    orderBy: [{ activa: 'desc' }, { canal: 'asc' }, { nombre: 'asc' }],
  });
  return filas.map(aDTO);
}

export async function findPlantilla(id: number): Promise<PlantillaDTO | null> {
  const fila = await prisma.plantilla.findUnique({ where: { id }, include: CON_AUTOR });
  return fila ? aDTO(fila) : null;
}

export async function findPlantillaPorNombre(nombre: string): Promise<PlantillaDTO | null> {
  const fila = await prisma.plantilla.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' } } });
  return fila ? aDTO(fila) : null;
}

export async function createPlantilla(dto: CreatePlantillaDTO): Promise<PlantillaDTO> {
  return aDTO(await prisma.plantilla.create({ data: dto, include: CON_AUTOR }));
}

export async function updatePlantilla(id: number, dto: UpdatePlantillaDTO): Promise<PlantillaDTO> {
  return aDTO(await prisma.plantilla.update({ where: { id }, data: dto, include: CON_AUTOR }));
}
