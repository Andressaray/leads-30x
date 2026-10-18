import type { Role, SessionUser } from '~types/auth.types';

export interface UserDTO {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Member of the sales team (no administrators), to filter "Contacted" by person. */
export interface MemberDTO {
  id: number;
  fullName: string;
  email: string;
  /** Leads assigned to them because they pressed "Contact". */
  contacted: number;
}

/** User with their hash: only the domain uses it to validate the password, it never goes out over HTTP. */
export interface UserWithHashDTO extends UserDTO {
  passwordHash: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface SessionDTO {
  token: string;
  user: SessionUser;
}
