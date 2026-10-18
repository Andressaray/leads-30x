import { PlantillasDomain, type PlantillasRepository } from 'modules/plantillas/domain/plantillas.domain';
import { capitalizar, capitalizarNombre, renderizar, variablesDesconocidas } from 'modules/plantillas/domain/plantillas.render';
import { AppError, HttpCode } from '~response/index';
import type { PlantillaDTO } from 'modules/plantillas/types/plantillas.types';
import type { UsuarioSesion } from '~types/auth.types';

const ANDRES: UsuarioSesion = { id: 1, email: 'andres@gmail.com', fullName: 'Andres Saray', rol: 'SERVICE' };
const CAMILA: UsuarioSesion = { id: 2, email: 'camila@gmail.com', fullName: 'Camila Rojas', rol: 'SERVICE' };
const ADMIN: UsuarioSesion = { id: 3, email: 'admin@gmail.com', fullName: 'Administrador', rol: 'ADMIN' };

const base: PlantillaDTO = {
  id: 1, nombre: 'Primer contacto', canal: 'EMAIL', asunto: 'Hola {{nombre}}', cuerpo: 'Texto largo de la plantilla',
  activa: true, creadoPorId: 1, createdAt: new Date(), updatedAt: new Date(),
};

function repo(existentes: PlantillaDTO[] = [base]): jest.Mocked<PlantillasRepository> {
  return {
    findPlantillas: jest.fn().mockResolvedValue(existentes),
    findPlantilla: jest.fn(async (id: number) => existentes.find((p) => p.id === id) ?? null),
    findPlantillaPorNombre: jest.fn(async (n: string) => existentes.find((p) => p.nombre.toLowerCase() === n.toLowerCase()) ?? null),
    createPlantilla: jest.fn(async (dto) => ({ ...base, ...dto, id: 2, asunto: dto.asunto ?? null })),
    updatePlantilla: jest.fn(async (id, dto) => ({ ...base, id, ...dto })),
  };
}

const status = (p: Promise<unknown>) => p.then(() => 0, (e: unknown) => (e instanceof AppError ? e.status : -1));

describe('render de plantillas', () => {
  it('reemplaza variables con o sin espacios y deja intactas las desconocidas', () => {
    const vars = { nombre: 'Café', municipio: 'Pasto', departamento: 'Nariño', categoria: 'cafés', remitente: 'Ana', empresa: 'X' };
    expect(renderizar('Hola {{nombre}} de {{ municipio }} {{otra}}', vars)).toBe('Hola Café de Pasto {{otra}}');
    expect(variablesDesconocidas('{{nombre}} {{nombre_}} {{x}} {{x}}')).toEqual(['nombre_', 'x']);
  });

  it('capitaliza municipios en mayúsculas', () => {
    expect(capitalizar('SAN JOSÉ DEL GUAVIARE')).toBe('San José del Guaviare');
    expect(capitalizar('EL CARMEN DE VIBORAL')).toBe('El Carmen de Viboral');
  });
});

describe('PlantillasDomain', () => {
  it('crea con el usuario como autor; WhatsApp no guarda asunto', async () => {
    const r = repo([]);
    await new PlantillasDomain(r).crear({ nombre: 'WA', canal: 'WHATSAPP', asunto: 'ignorado', cuerpo: 'Hola {{nombre}}, ¿cómo están?' }, CAMILA);
    expect(r.createPlantilla).toHaveBeenCalledWith(expect.objectContaining({ canal: 'WHATSAPP', asunto: null, creadoPorId: 2 }));
  });

  it('correo sin asunto, variable desconocida o nombre repetido → error', async () => {
    const d = new PlantillasDomain(repo());
    expect(await status(d.crear({ nombre: 'Nueva', canal: 'EMAIL', cuerpo: 'Texto de prueba largo' }, ANDRES))).toBe(HttpCode.BAD_REQUEST);
    expect(await status(d.crear({ nombre: 'Nueva', canal: 'EMAIL', asunto: 'Hola {{nombe}}', cuerpo: 'Texto de prueba largo' }, ANDRES))).toBe(HttpCode.BAD_REQUEST);
    expect(await status(d.crear({ nombre: 'primer CONTACTO', canal: 'WHATSAPP', cuerpo: 'Texto de prueba largo' }, ANDRES))).toBe(HttpCode.CONFLICT);
  });

  it('solo quien la creó o un ADMIN la edita', async () => {
    const r = repo();
    const d = new PlantillasDomain(r);
    expect(await status(d.actualizar(1, { activa: false }, CAMILA))).toBe(HttpCode.FORBIDDEN);
    await d.actualizar(1, { activa: false }, ADMIN);
    await d.actualizar(1, { cuerpo: 'Nuevo texto {{remitente}}' }, ANDRES);
    expect(r.updatePlantilla).toHaveBeenCalledTimes(2);
    expect(await status(d.actualizar(1, { asunto: '' }, ANDRES))).toBe(HttpCode.BAD_REQUEST);
    expect(await status(d.actualizar(9, { activa: false }, ADMIN))).toBe(HttpCode.NOT_FOUND);
  });
});

describe('capitalizarNombre', () => {
  it('normaliza nombres en mayúsculas sin dañar siglas', () => {
    expect(capitalizarNombre('AUTODORADO TRANSPORTE ESPECIAL S.A.S.')).toBe('Autodorado Transporte Especial S.A.S.');
    expect(capitalizarNombre('PANAMERICANA DE VIAJES SAS PRINCIPAL')).toBe('Panamericana de Viajes SAS Principal');
    expect(capitalizarNombre('NH COLLECTION ROYAL TELEPORT')).toBe('NH Collection Royal Teleport');
    expect(capitalizarNombre('CAJACOPI UNIDAD PRADO')).toBe('Cajacopi Unidad Prado');
    expect(capitalizarNombre('BOGOTÁ, D.C.')).toBe('Bogotá, D.C.');
    expect(capitalizarNombre('ARCHIPIÉLAGO DE SAN ANDRÉS, PROVIDENCIA Y SANTA CATALINA')).toBe('Archipiélago de San Andrés, Providencia y Santa Catalina');
    expect(capitalizarNombre('LA 14 LTDA')).toBe('La 14 LTDA');
  });
  it('respeta nombres que ya vienen con su forma', () => {
    expect(capitalizarNombre('Café de la Esquina')).toBe('Café de la Esquina');
  });
});
