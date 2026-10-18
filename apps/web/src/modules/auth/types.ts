export type { Role, Session, SessionUser } from "@/shared/lib/session-store";

/** GET /api/users/members: active users without the ADMIN role. */
export interface Member {
  id: number;
  fullName: string;
  email: string;
  /** Leads assigned to them because they pressed "Contact". */
  contacted: number;
}

export interface Credentials {
  email: string;
  password: string;
}
