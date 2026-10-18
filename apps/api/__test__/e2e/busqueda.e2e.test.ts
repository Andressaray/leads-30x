// De punta a punta: HTTP → dominio → fuentes (red simulada) → PostgreSQL real.
import request from 'supertest';
import { crearApp } from '~config/app';
import { crearRedFalsa } from '~mocks/services/fuentes.mock';
import { crearUsuarioDePrueba, describeConBase, limpiarBase, prisma } from '../setup/db';

const red = crearRedFalsa();
jest.spyOn(global, 'fetch').mockImplementation((input: string | URL | Request, init?: RequestInit) => red.fetch(String(input), init));

describeConBase('POST /api/busquedas de punta a punta', () => {
  const app = crearApp();
  let api: ReturnType<typeof request.agent>;
  let token2: string;

  beforeAll(async () => {
    await limpiarBase();
    await crearUsuarioDePrueba();
    await crearUsuarioDePrueba({ email: 'camila@gmail.com', fullName: 'Camila Rojas' });
    // Login real: correo + contraseña → token
    const login = await request(app).post('/api/auth/login').send({ email: 'andres@gmail.com', password: 'Andres1234*' });
    expect(login.status).toBe(200);
    api = request.agent(app).set('Authorization', `Bearer ${login.body.data.token}`);
    token2 = (await request(app).post('/api/auth/login').send({ email: 'camila@gmail.com', password: 'Andres1234*' })).body.data.token;
  });
  afterAll(() => prisma.$disconnect());

  it('sin login no deja buscar', async () => {
    const r = await request(app).post('/api/busquedas').send({ codigo: '05615' });
    expect(r.status).toBe(401);
    const malo = await request(app).post('/api/auth/login').send({ email: 'andres@gmail.com', password: 'mala' });
    expect(malo.status).toBe(401);
  });

  it('guarda los leads cruzados en PostgreSQL y repetir no duplica', async () => {
    const r1 = await api.post('/api/busquedas').send({ ciudad: 'Rionegro', departamento: 'Antioquia', categoria: 'hoteles' });
    expect(r1.status).toBe(201);
    expect(r1.body.data.resumen).toMatchObject({ leads: 7, nuevos: 7, contactables: 5, enVariasFuentes: 4 });

    const r2 = await api.post('/api/busquedas').send({ codigo: '05615', categoria: 'hotel' });
    expect(r2.body.data.resumen).toMatchObject({ leads: 7, nuevos: 0 });
    expect(await prisma.lead.count()).toBe(7);

    const ambos = await api.get('/api/leads?en_ambas=true');
    expect(ambos.body.data.total).toBe(4);

    const id = ambos.body.data.leads.find((l: { nit: string }) => l.nit === '901333444').id;
    const detalle = await api.get(`/api/leads/${id}`);
    expect(detalle.body.data.apariciones.map((a: { fuente: string; coincidencia: string }) => `${a.fuente}:${a.coincidencia}`)).toEqual(
      expect.arrayContaining(['dane:nuevo', 'secop:nit', 'osm:direccion'])
    );

    const csv = await api.get(`/api/leads/export.csv?busqueda=${r1.body.data.busquedaId}&contactable=true`);
    expect(csv.text.trim().split('\n')).toHaveLength(6);

    const stats = await api.get('/api/leads/estadisticas');
    expect(stats.body.data.map((s: { fuente: string }) => s.fuente)).toEqual(['dane', 'osm', 'rnt', 'secop']);
  });

  it('Contactar asigna el lead a quien lo contactó y Contactados filtra por persona', async () => {
    const lista = (await api.get('/api/leads?limite=3')).body.data.leads as { id: number }[];
    const [uno, dos] = lista.map((l) => l.id);

    const r = await api.post(`/api/leads/${uno}/contactar`);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ contactado: true, contactadoPor: { fullName: 'Andres Saray' } });

    const camila = (path: string) => request(app).post(path).set('Authorization', `Bearer ${token2}`);
    const choque = await camila(`/api/leads/${uno}/contactar`);
    expect(choque.status).toBe(409);
    expect(choque.body.error).toBe('Este lead ya lo contactó Andres Saray.');
    expect((await camila(`/api/leads/${dos}/contactar`)).status).toBe(200);

    const todos = (await api.get('/api/leads?contactado=true')).body.data;
    expect(todos.total).toBe(2);
    expect(todos.leads.map((l: { contactadoPor: { fullName: string } }) => l.contactadoPor.fullName).sort()).toEqual(['Andres Saray', 'Camila Rojas']);
    const mios = (await api.get('/api/leads?contactado=true&mios=true')).body.data;
    expect(mios.leads.map((l: { id: number }) => l.id)).toEqual([uno]);

    const csv = await api.get('/api/leads/export.csv?contactado=true');
    expect(csv.text).toContain('Andres Saray');
  });
});
