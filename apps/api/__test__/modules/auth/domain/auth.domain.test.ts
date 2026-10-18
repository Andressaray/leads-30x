// Reglas del login con un repositorio simulado.
import bcrypt from 'bcryptjs';
import { AuthDomain, type AuthRepository } from 'modules/auth/domain/auth.domain';
import type { UsuarioConHashDTO } from 'modules/auth/types/auth.types';
import { verificarToken } from '~utils/token';

const SECRETO = process.env.JWT_SECRET!;
const hash = bcrypt.hashSync('Andres1234*', 4);

function usuario(p: Partial<UsuarioConHashDTO> = {}): UsuarioConHashDTO {
  const ahora = new Date();
  return { id: 1, email: 'andres@gmail.com', fullName: 'Andres Saray', rol: 'SERVICE', activo: true, passwordHash: hash, createdAt: ahora, updatedAt: ahora, ...p };
}

function preparar(u: UsuarioConHashDTO | null = usuario()) {
  const repo = {
    findUsuarioPorEmail: jest.fn(async (email: string) => (u && u.email === email ? u : null)),
    findUsuarioPorId: jest.fn(async (id: number) => (u && u.id === id ? (({ passwordHash: _h, ...r }) => r)(u) : null)),
    findUsuarios: jest.fn(async () => []),
    findMiembros: jest.fn(async () => [{ id: 1, fullName: 'Andres Saray', email: 'andres@gmail.com', contactados: 3 }]),
  } as unknown as jest.Mocked<AuthRepository>;
  return { repo, dominio: new AuthDomain(repo, { secreto: SECRETO, expiraEn: '1h' }) };
}

describe('AuthDomain.login', () => {
  it('con la contraseña correcta devuelve un token con el usuario y sin el hash', async () => {
    const { dominio } = preparar();
    const sesion = await dominio.login({ email: 'Andres@Gmail.com ', password: 'Andres1234*' });
    expect(sesion.usuario).toEqual({ id: 1, email: 'andres@gmail.com', fullName: 'Andres Saray', rol: 'SERVICE' });
    expect(JSON.stringify(sesion)).not.toContain('$2');
    expect(verificarToken(sesion.token, SECRETO)).toEqual(sesion.usuario);
  });

  it('contraseña incorrecta o correo inexistente → 401 con el mismo mensaje', async () => {
    const { dominio } = preparar();
    const a = dominio.login({ email: 'andres@gmail.com', password: 'otra' });
    const b = dominio.login({ email: 'nadie@gmail.com', password: 'Andres1234*' });
    await expect(a).rejects.toMatchObject({ status: 401, message: 'Correo o contraseña incorrectos.' });
    await expect(b).rejects.toMatchObject({ status: 401, message: 'Correo o contraseña incorrectos.' });
  });

  it('usuario desactivado → 401', async () => {
    const { dominio } = preparar(usuario({ activo: false }));
    await expect(dominio.login({ email: 'andres@gmail.com', password: 'Andres1234*' })).rejects.toMatchObject({ status: 401 });
  });
});

describe('AuthDomain.yo', () => {
  it('devuelve el usuario actual y 401 si ya no existe', async () => {
    const { dominio } = preparar();
    const sesion = { id: 1, email: 'andres@gmail.com', fullName: 'Andres Saray', rol: 'SERVICE' as const };
    expect(await dominio.yo(sesion)).toMatchObject({ id: 1, rol: 'SERVICE' });
    await expect(dominio.yo({ ...sesion, id: 99 })).rejects.toMatchObject({ status: 401 });
  });
});

describe('AuthDomain.listarMiembros', () => {
  it('devuelve los miembros del repositorio con su número de contactados', async () => {
    const { dominio, repo } = preparar();
    expect(await dominio.listarMiembros()).toEqual([{ id: 1, fullName: 'Andres Saray', email: 'andres@gmail.com', contactados: 3 }]);
    expect(repo.findMiembros).toHaveBeenCalled();
  });
});
