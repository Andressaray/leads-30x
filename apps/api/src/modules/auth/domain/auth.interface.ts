import type { SessionUser } from '~types/auth.types';
import type { LoginDTO, MemberDTO, SessionDTO, UserDTO } from '../types/auth.types';

export interface AuthDomainInterface {
  /** Validates email and password and returns a session token. Throws 401 if they do not match or the user is inactive. */
  login(data: LoginDTO): Promise<SessionDTO>;
  /** Current data of the session user. Throws 401 if it no longer exists or is inactive. */
  me(session: SessionUser): Promise<UserDTO>;
  /** Every user (without passwords). */
  listUsers(): Promise<UserDTO[]>;
  /** Active users without the ADMIN role, with their number of contacted leads (to filter Contacted). */
  listMembers(): Promise<MemberDTO[]>;
}
