export type { Rol, Sesion, UsuarioSesion } from "@/shared/lib/session-store";

/** GET /api/usuarios/miembros: usuarios activos sin rol ADMIN. */
export interface Miembro {
  id: number;
  fullName: string;
  email: string;
  /** Leads que tiene asignados por haberles dado "Contactar". */
  contactados: number;
}

export interface Credenciales {
  email: string;
  password: string;
}
