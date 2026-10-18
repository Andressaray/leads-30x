// Reglas de las plantillas de mensaje: variables válidas, asunto obligatorio en correo,
// nombres únicos y quién puede editarlas.
import * as repositorioReal from '../repository/plantillas.repository';
import { AppError, HttpCode } from '~response/index';
import type { UsuarioSesion } from '~types/auth.types';
import type { PlantillasDomainInterface } from './plantillas.interface';
import { VARIABLES, variablesDesconocidas } from './plantillas.render';
import type { CreatePlantillaDTO, FiltrosPlantillasDTO, PlantillaDTO, UpdatePlantillaDTO } from '../types/plantillas.types';

export type PlantillasRepository = typeof repositorioReal;

function validarVariables(...textos: (string | null | undefined)[]): void {
  const malas = [...new Set(textos.flatMap((t) => (t ? variablesDesconocidas(t) : [])))];
  if (malas.length) {
    throw new AppError(
      HttpCode.BAD_REQUEST,
      `Variable desconocida: ${malas.map((m) => `{{${m}}}`).join(', ')}. Usa: ${Object.keys(VARIABLES).map((v) => `{{${v}}}`).join(', ')}.`,
      { campo: 'cuerpo', desconocidas: malas }
    );
  }
}

export class PlantillasDomain implements PlantillasDomainInterface {
  constructor(private readonly repo: PlantillasRepository = repositorioReal) {}

  listar(filtros: FiltrosPlantillasDTO): Promise<PlantillaDTO[]> {
    return this.repo.findPlantillas(filtros);
  }

  async obtener(id: number): Promise<PlantillaDTO> {
    const p = await this.repo.findPlantilla(id);
    if (!p) throw new AppError(HttpCode.NOT_FOUND, 'Plantilla no encontrada.');
    return p;
  }

  async crear(dto: Omit<CreatePlantillaDTO, 'creadoPorId'>, usuario: UsuarioSesion): Promise<PlantillaDTO> {
    const asunto = dto.canal === 'EMAIL' ? dto.asunto?.trim() || null : null;
    if (dto.canal === 'EMAIL' && !asunto) {
      throw new AppError(HttpCode.BAD_REQUEST, 'Las plantillas de correo necesitan un asunto.', { campo: 'asunto' });
    }
    validarVariables(asunto, dto.cuerpo);
    await this.nombreLibre(dto.nombre);
    return this.repo.createPlantilla({ ...dto, asunto, creadoPorId: usuario.id });
  }

  async actualizar(id: number, dto: UpdatePlantillaDTO, usuario: UsuarioSesion): Promise<PlantillaDTO> {
    const actual = await this.obtener(id);
    if (usuario.rol !== 'ADMIN' && actual.creadoPorId !== usuario.id) {
      throw new AppError(HttpCode.FORBIDDEN, 'Solo quien creó la plantilla o un administrador puede cambiarla.');
    }
    const cambios: UpdatePlantillaDTO = { ...dto };
    if (actual.canal !== 'EMAIL') delete cambios.asunto;
    else if (cambios.asunto !== undefined && !cambios.asunto?.trim()) {
      throw new AppError(HttpCode.BAD_REQUEST, 'Las plantillas de correo necesitan un asunto.', { campo: 'asunto' });
    }
    validarVariables(cambios.asunto, cambios.cuerpo);
    if (cambios.nombre && cambios.nombre.toLowerCase() !== actual.nombre.toLowerCase()) await this.nombreLibre(cambios.nombre);
    return this.repo.updatePlantilla(id, cambios);
  }

  private async nombreLibre(nombre: string): Promise<void> {
    if (await this.repo.findPlantillaPorNombre(nombre)) {
      throw new AppError(HttpCode.CONFLICT, `Ya existe una plantilla llamada "${nombre}".`, { campo: 'nombre' });
    }
  }
}
