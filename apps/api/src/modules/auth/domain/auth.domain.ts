// Login business rules: password with bcrypt and session with JWT.
import bcrypt from 'bcryptjs';
import { environment } from '~config/environment';
import { AppError, HttpCode } from '~response/index';
import type { SessionUser } from '~types/auth.types';
import { signToken } from '~utils/token';
import * as realRepository from '../repository/auth.repository';
import type { LoginDTO, MemberDTO, SessionDTO, UserDTO } from '../types/auth.types';
import type { AuthDomainInterface } from './auth.interface';

export type AuthRepository = typeof realRepository;

const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos.';
// Dummy hash: if the email does not exist it still compares, so the response time
// does not reveal which emails are registered.
let dummyHash: string | undefined;
const dummy = () => (dummyHash ??= bcrypt.hashSync('no-user', 10));

export class AuthDomain implements AuthDomainInterface {
  constructor(
    private readonly repo: AuthRepository = realRepository,
    private readonly config = { secret: environment.jwtSecret, expiresIn: environment.jwtExpiresIn }
  ) {}

  async login({ email, password }: LoginDTO): Promise<SessionDTO> {
    const user = await this.repo.findUserByEmail(email.trim().toLowerCase());
    const valid = await bcrypt.compare(password, user?.passwordHash ?? dummy());
    if (!user || !valid) throw new AppError(HttpCode.UNAUTHORIZED, INVALID_CREDENTIALS);
    if (!user.active) throw new AppError(HttpCode.UNAUTHORIZED, 'Tu usuario está desactivado. Habla con un administrador.');
    const session: SessionUser = { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
    return { token: signToken(session, this.config.secret, this.config.expiresIn), user: session };
  }

  async me(session: SessionUser): Promise<UserDTO> {
    const user = await this.repo.findUserById(session.id);
    if (!user || !user.active) throw new AppError(HttpCode.UNAUTHORIZED, 'La sesión ya no es válida. Inicia sesión de nuevo.');
    return user;
  }

  async listUsers(): Promise<UserDTO[]> {
    return this.repo.findUsers();
  }

  async listMembers(): Promise<MemberDTO[]> {
    return this.repo.findMembers();
  }
}
