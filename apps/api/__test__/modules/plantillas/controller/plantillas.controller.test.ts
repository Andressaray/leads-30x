import request from 'supertest';
import { PlantillasDomain } from 'modules/plantillas/domain/plantillas.domain';
import { AppError, HttpCode } from '~response/index';
import { crearApp } from '~config/app';
import { ANDRES, bearer } from '../../../setup/auth';

// Un solo objeto simulado para todas las instancias (el módulo de contactos también crea una).
jest.mock('modules/plantillas/domain/plantillas.domain', () => {
  const unico = { listar: jest.fn(), obtener: jest.fn(), crear: jest.fn(), actualizar: jest.fn() };
  return { PlantillasDomain: jest.fn(() => unico) };
});
jest.mock('modules/busquedas/domain/busquedas.domain');

const app = crearApp();
const api = request.agent(app).set('Authorization', bearer());
const dominio = new PlantillasDomain() as jest.Mocked<PlantillasDomain>;

describe('/api/plantillas', () => {
  it('lista con filtros y pide sesión', async () => {
    dominio.listar.mockResolvedValue([]);
    expect((await api.get('/api/plantillas?canal=whatsapp&inactivas=true')).status).toBe(200);
    expect(dominio.listar).toHaveBeenCalledWith({ canal: 'WHATSAPP', incluirInactivas: true });
    expect((await request(app).get('/api/plantillas')).status).toBe(401);
  });

  it('variables disponibles', async () => {
    const r = await api.get('/api/plantillas/variables');
    expect(r.body.data.map((v: { nombre: string }) => v.nombre)).toEqual(['nombre', 'municipio', 'departamento', 'categoria', 'remitente', 'empresa']);
  });

  it('crea (201) con el usuario de la sesión', async () => {
    dominio.crear.mockResolvedValue({ id: 1 } as never);
    const r = await api.post('/api/plantillas').send({ nombre: 'Correo', canal: 'email', asunto: 'Hola', cuerpo: 'Un texto bastante largo' });
    expect(r.status).toBe(201);
    expect(dominio.crear).toHaveBeenCalledWith({ nombre: 'Correo', canal: 'EMAIL', asunto: 'Hola', cuerpo: 'Un texto bastante largo' }, ANDRES);
  });

  it.each([
    [{ canal: 'EMAIL', cuerpo: 'Un texto bastante largo' }, 'nombre'],
    [{ nombre: 'X1', canal: 'SMS', cuerpo: 'Un texto bastante largo' }, 'canal'],
    [{ nombre: 'X1', canal: 'EMAIL', cuerpo: 'corto' }, 'cuerpo'],
  ])('valida %j → 400 (%s)', async (body, campo) => {
    const r = await api.post('/api/plantillas').send(body);
    expect(r.status).toBe(400);
    expect(r.body.details).toEqual({ campo });
    expect(dominio.crear).not.toHaveBeenCalled();
  });

  it('edita y traduce los AppError', async () => {
    dominio.actualizar.mockRejectedValue(new AppError(HttpCode.FORBIDDEN, 'No'));
    const r = await api.patch('/api/plantillas/3').send({ activa: false });
    expect(r.status).toBe(403);
    expect(dominio.actualizar).toHaveBeenCalledWith(3, { activa: false }, ANDRES);
    expect((await api.patch('/api/plantillas/3').send({ activa: 'no' })).status).toBe(400);
  });
});
