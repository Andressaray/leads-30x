// Reglas de negocio del login: contraseña con bcrypt y sesión con JWT.
import bcrypt from 'bcryptjs';
import { environment } from '~config/environment';
import { AppError, HttpCode } from '~response/index';
import type { UsuarioSesion } from '~types/auth.types';
import { firmarToken } from '~utils/token';
import * as repositorioReal from '../repository/auth.repository';
import type { LoginDTO, MiembroDTO, SesionDTO, UsuarioDTO } from '../types/auth.types';
import type { AuthDomainInterface } from './auth.interface';

export type AuthRepository = typeof repositorioReal;

const CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos.';
// Hash de relleno: si el correo no existe se compara igual, para que el tiempo de respuesta
// no revele qué correos están registrados.
let hashRelleno: string | undefined;
const relleno = () => (hashRelleno ??= bcrypt.hashSync('sin-usuario', 10));

export class AuthDomain implements AuthDomainInterface {
  constructor(
    private readonly repo: AuthRepository = repositorioReal,
    private readonly config = { secreto: environment.jwtSecret, expiraEn: environment.jwtExpiraEn }
  ) {}

  async login({ email, password }: LoginDTO): Promise<SesionDTO> {
    const usuario = await this.repo.findUsuarioPorEmail(email.trim().toLowerCase());
    const valida = await bcrypt.compare(password, usuario?.passwordHash ?? relleno());
    if (!usuario || !valida) throw new AppError(HttpCode.UNAUTHORIZED, CREDENCIALES_INVALIDAS);
    if (!usuario.activo) throw new AppError(HttpCode.UNAUTHORIZED, 'Tu usuario está desactivado. Habla con un administrador.');
    const sesion: UsuarioSesion = { id: usuario.id, email: usuario.email, fullName: usuario.fullName, rol: usuario.rol };
    return { token: firmarToken(sesion, this.config.secreto, this.config.expiraEn), usuario: sesion };
  }

  async yo(sesion: UsuarioSesion): Promise<UsuarioDTO> {
    const usuario = await this.repo.findUsuarioPorId(sesion.id);
    if (!usuario || !usuario.activo) throw new AppError(HttpCode.UNAUTHORIZED, 'La sesión ya no es válida. Inicia sesión de nuevo.');
    return usuario;
  }

  async listarUsuarios(): Promise<UsuarioDTO[]> {
    return this.repo.findUsuarios();
  }

  async listarMiembros(): Promise<MiembroDTO[]> {
    return this.repo.findMiembros();
  }
}
