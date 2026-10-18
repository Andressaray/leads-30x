// Current session user, as it travels inside the token (JWT).

export const ROLES = ['SERVICE', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export interface SessionUser {
  id: number;
  email: string;
  fullName: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by verifyAuth when the token is valid. */
      user?: SessionUser;
    }
  }
}
