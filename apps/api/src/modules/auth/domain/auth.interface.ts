import type { UsuarioSesion } from '~types/auth.types';
import type { LoginDTO, MiembroDTO, SesionDTO, UsuarioDTO } from '../types/auth.types';

export interface AuthDomainInterface {
  /** Valida correo y contraseña y devuelve un token de sesión. Lanza 401 si no coinciden o el usuario está inactivo. */
  login(datos: LoginDTO): Promise<SesionDTO>;
  /** Datos actuales del usuario de la sesión. Lanza 401 si ya no existe o está inactivo. */
  yo(sesion: UsuarioSesion): Promise<UsuarioDTO>;
  /** Todos los usuarios (sin contraseñas). */
  listarUsuarios(): Promise<UsuarioDTO[]>;
  /** Usuarios activos sin rol ADMIN, con su número de leads contactados (para filtrar Contactados). */
  listarMiembros(): Promise<MiembroDTO[]>;
}
