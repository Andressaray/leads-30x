// Utilidades para las pruebas de repositorio contra la base de pruebas real.
import { prisma } from '~config/db/client';

export const hayBaseDePruebas = Boolean(process.env.DATABASE_URL_TEST);

/** describe() que se salta (con aviso) si no hay base de pruebas configurada. */
export const describeConBase: jest.Describe = hayBaseDePruebas ? describe : describe.skip;

export async function limpiarBase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE calificaciones, costos, interacciones, plantillas, busqueda_leads, apariciones, lead_claves, leads, busqueda_fuentes, busquedas, usuarios RESTART IDENTITY CASCADE'
  );
}

export async function crearBusquedaDePrueba(codMpio = '05615'): Promise<number> {
  const b = await prisma.busqueda.create({
    data: { codMpio, municipio: 'RIONEGRO', departamento: 'Antioquia', filtros: {}, fuentesPedidas: ['dane'] },
  });
  return b.id;
}

export { prisma };

/** Crea un usuario de prueba (contraseña con hash barato para que la prueba sea rápida). */
export async function crearUsuarioDePrueba(
  p: { email?: string; fullName?: string; rol?: 'SERVICE' | 'ADMIN'; password?: string } = {}
): Promise<number> {
  const bcrypt = await import('bcryptjs');
  const u = await prisma.usuario.create({
    data: {
      email: p.email ?? 'andres@gmail.com',
      fullName: p.fullName ?? 'Andres Saray',
      rol: p.rol ?? 'SERVICE',
      passwordHash: bcrypt.hashSync(p.password ?? 'Andres1234*', 4),
    },
  });
  return u.id;
}
