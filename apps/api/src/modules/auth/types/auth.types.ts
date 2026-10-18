import type { Rol, UsuarioSesion } from '~types/auth.types';

export interface UsuarioDTO {
  id: number;
  email: string;
  fullName: string;
  rol: Rol;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Integrante del equipo comercial (sin administradores), para filtrar "Contactados" por persona. */
export interface MiembroDTO {
  id: number;
  fullName: string;
  email: string;
  /** Leads que tiene asignados por haberles dado "Contactar". */
  contactados: number;
}

/** Usuario con su hash: solo lo usa el dominio para validar la contraseña, nunca sale por HTTP. */
export interface UsuarioConHashDTO extends UsuarioDTO {
  passwordHash: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface SesionDTO {
  token: string;
  usuario: UsuarioSesion;
}
