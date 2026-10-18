import type { UsuarioSesion } from '~types/auth.types';
import type { CreatePlantillaDTO, FiltrosPlantillasDTO, PlantillaDTO, UpdatePlantillaDTO } from '../types/plantillas.types';

export interface PlantillasDomainInterface {
  listar(filtros: FiltrosPlantillasDTO): Promise<PlantillaDTO[]>;
  /** Lanza 404 si no existe. */
  obtener(id: number): Promise<PlantillaDTO>;
  /** Lanza 400 si usa variables que no existen o si es de correo sin asunto; 409 si el nombre ya existe. */
  crear(dto: Omit<CreatePlantillaDTO, 'creadoPorId'>, usuario: UsuarioSesion): Promise<PlantillaDTO>;
  /** Solo quien la creó o un ADMIN (403). Desactivar = activa: false. */
  actualizar(id: number, dto: UpdatePlantillaDTO, usuario: UsuarioSesion): Promise<PlantillaDTO>;
}
