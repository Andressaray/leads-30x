// Usuario de la sesión actual, tal como viaja dentro del token (JWT).

export const ROLES = ['SERVICE', 'ADMIN'] as const;
export type Rol = (typeof ROLES)[number];

export interface UsuarioSesion {
  id: number;
  email: string;
  fullName: string;
  rol: Rol;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Lo pone verifyAuth cuando el token es válido. */
      usuario?: UsuarioSesion;
    }
  }
}
