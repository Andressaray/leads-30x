// Login rules with a simulated repository.
import bcrypt from 'bcryptjs';
import { AuthDomain, type AuthRepository } from 'modules/auth/domain/auth.domain';
import type { UserWithHashDTO } from 'modules/auth/types/auth.types';
import { verifyToken } from '~utils/token';

const SECRET = process.env.JWT_SECRET!;
const hash = bcrypt.hashSync('Andres1234*', 4);

function user(p: Partial<UserWithHashDTO> = {}): UserWithHashDTO {
  const now = new Date();
  return { id: 1, email: 'andres@gmail.com', fullName: 'Andres Saray', role: 'SERVICE', active: true, passwordHash: hash, createdAt: now, updatedAt: now, ...p };
}

function prepare(u: UserWithHashDTO | null = user()) {
  const repo = {
    findUserByEmail: jest.fn(async (email: string) => (u && u.email === email ? u : null)),
    findUserById: jest.fn(async (id: number) => (u && u.id === id ? (({ passwordHash: _h, ...r }) => r)(u) : null)),
    findUsers: jest.fn(async () => []),
    findMembers: jest.fn(async () => [{ id: 1, fullName: 'Andres Saray', email: 'andres@gmail.com', contacted: 3 }]),
  } as unknown as jest.Mocked<AuthRepository>;
  return { repo, domain: new AuthDomain(repo, { secret: SECRET, expiresIn: '1h' }) };
}

describe('AuthDomain.login', () => {
  it('with the right password returns a token with the user and without the hash', async () => {
    const { domain } = prepare();
    const session = await domain.login({ email: 'Andres@Gmail.com ', password: 'Andres1234*' });
    expect(session.user).toEqual({ id: 1, email: 'andres@gmail.com', fullName: 'Andres Saray', role: 'SERVICE' });
    expect(JSON.stringify(session)).not.toContain('$2');
    expect(verifyToken(session.token, SECRET)).toEqual(session.user);
  });

  it('wrong password or unknown email → 401 with the same message', async () => {
    const { domain } = prepare();
    const a = domain.login({ email: 'andres@gmail.com', password: 'otra' });
    const b = domain.login({ email: 'nadie@gmail.com', password: 'Andres1234*' });
    await expect(a).rejects.toMatchObject({ status: 401, message: 'Correo o contraseña incorrectos.' });
    await expect(b).rejects.toMatchObject({ status: 401, message: 'Correo o contraseña incorrectos.' });
  });

  it('deactivated user → 401', async () => {
    const { domain } = prepare(user({ active: false }));
    await expect(domain.login({ email: 'andres@gmail.com', password: 'Andres1234*' })).rejects.toMatchObject({ status: 401 });
  });
});

describe('AuthDomain.me', () => {
  it('returns the current user and 401 if it no longer exists', async () => {
    const { domain } = prepare();
    const session = { id: 1, email: 'andres@gmail.com', fullName: 'Andres Saray', role: 'SERVICE' as const };
    expect(await domain.me(session)).toMatchObject({ id: 1, role: 'SERVICE' });
    await expect(domain.me({ ...session, id: 99 })).rejects.toMatchObject({ status: 401 });
  });
});

describe('AuthDomain.listMembers', () => {
  it('returns the members from the repository with their contacted count', async () => {
    const { domain, repo } = prepare();
    expect(await domain.listMembers()).toEqual([{ id: 1, fullName: 'Andres Saray', email: 'andres@gmail.com', contacted: 3 }]);
    expect(repo.findMembers).toHaveBeenCalled();
  });
});
