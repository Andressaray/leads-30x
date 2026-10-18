// Pruebas de integración contra la base de pruebas real (DATABASE_URL_TEST).
import * as repo from 'modules/auth/repository/auth.repository';
import { crearUsuarioDePrueba, describeConBase, limpiarBase, prisma } from '../../../setup/db';

async function leadContactadoPor(usuarioId: number | null, contactado = true, n = 1): Promise<void> {
  await prisma.lead.create({
    data: {
      nombre: `Lead ${n}`, codMpio: '05615', municipio: 'RIONEGRO', departamento: 'Antioquia', fuenteOrigen: 'osm',
      contactado, contactadoPorId: usuarioId, contactadoEn: contactado ? new Date() : null,
    },
  });
}

describeConBase('auth.repository.findMiembros', () => {
  beforeEach(limpiarBase);
  afterAll(() => prisma.$disconnect());

  it('excluye ADMIN e inactivos, ordena por nombre y cuenta solo los contactados', async () => {
    const andres = await crearUsuarioDePrueba();
    const camila = await crearUsuarioDePrueba({ email: 'camila@gmail.com', fullName: 'Camila Rojas' });
    const admin = await crearUsuarioDePrueba({ email: 'admin@gmail.com', fullName: 'Administrador', rol: 'ADMIN' });
    const inactivo = await crearUsuarioDePrueba({ email: 'beto@gmail.com', fullName: 'Beto Inactivo' });
    await prisma.usuario.update({ where: { id: inactivo }, data: { activo: false } });

    await leadContactadoPor(andres, true, 1);
    await leadContactadoPor(andres, true, 2);
    await leadContactadoPor(camila, false, 3); // asignado pero sin marcar: no cuenta
    await leadContactadoPor(admin, true, 4);

    expect(await repo.findMiembros()).toEqual([
      { id: andres, fullName: 'Andres Saray', email: 'andres@gmail.com', contactados: 2 },
      { id: camila, fullName: 'Camila Rojas', email: 'camila@gmail.com', contactados: 0 },
    ]);
  });
});
