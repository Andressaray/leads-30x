import { TemplatesDomain, type TemplatesRepository } from 'modules/templates/domain/templates.domain';
import { capitalize, capitalizeName, render, unknownVariables } from 'modules/templates/domain/templates.render';
import { AppError, HttpCode } from '~response/index';
import type { TemplateDTO } from 'modules/templates/types/templates.types';
import type { SessionUser } from '~types/auth.types';

const ANDRES: SessionUser = { id: 1, email: 'andres@gmail.com', fullName: 'Andres Saray', role: 'SERVICE' };
const CAMILA: SessionUser = { id: 2, email: 'camila@gmail.com', fullName: 'Camila Rojas', role: 'SERVICE' };
const ADMIN: SessionUser = { id: 3, email: 'admin@gmail.com', fullName: 'Administrador', role: 'ADMIN' };

const base: TemplateDTO = {
  id: 1, name: 'Primer contacto', channel: 'EMAIL', subject: 'Hola {{nombre}}', body: 'Texto largo de la plantilla',
  active: true, createdById: 1, createdAt: new Date(), updatedAt: new Date(),
};

function repo(existing: TemplateDTO[] = [base]): jest.Mocked<TemplatesRepository> {
  return {
    findTemplates: jest.fn().mockResolvedValue(existing),
    findTemplate: jest.fn(async (id: number) => existing.find((p) => p.id === id) ?? null),
    findTemplateByName: jest.fn(async (n: string) => existing.find((p) => p.name.toLowerCase() === n.toLowerCase()) ?? null),
    createTemplate: jest.fn(async (dto) => ({ ...base, ...dto, id: 2, subject: dto.subject ?? null })),
    updateTemplate: jest.fn(async (id, dto) => ({ ...base, id, ...dto })),
  };
}

const status = (p: Promise<unknown>) => p.then(() => 0, (e: unknown) => (e instanceof AppError ? e.status : -1));

describe('template rendering', () => {
  it('replaces variables with or without spaces and leaves unknown ones untouched', () => {
    const vars = { name: 'Café', municipality: 'Pasto', department: 'Nariño', category: 'cafés', sender: 'Ana', company: 'X' };
    expect(render('Hola {{nombre}} de {{ municipio }} {{otra}}', vars)).toBe('Hola Café de Pasto {{otra}}');
    expect(unknownVariables('{{nombre}} {{nombre_}} {{x}} {{x}}')).toEqual(['nombre_', 'x']);
  });

  it('capitalizes uppercase municipalities', () => {
    expect(capitalize('SAN JOSÉ DEL GUAVIARE')).toBe('San José del Guaviare');
    expect(capitalize('EL CARMEN DE VIBORAL')).toBe('El Carmen de Viboral');
  });
});

describe('PlantillasDomain', () => {
  it('creates with the user as author; WhatsApp does not store a subject', async () => {
    const r = repo([]);
    await new TemplatesDomain(r).create({ name: 'WA', channel: 'WHATSAPP', subject: 'ignorado', body: 'Hola {{nombre}}, ¿cómo están?' }, CAMILA);
    expect(r.createTemplate).toHaveBeenCalledWith(expect.objectContaining({ channel: 'WHATSAPP', subject: null, createdById: 2 }));
  });

  it('email without subject, unknown variable or repeated name → error', async () => {
    const d = new TemplatesDomain(repo());
    expect(await status(d.create({ name: 'Nueva', channel: 'EMAIL', body: 'Texto de prueba largo' }, ANDRES))).toBe(HttpCode.BAD_REQUEST);
    expect(await status(d.create({ name: 'Nueva', channel: 'EMAIL', subject: 'Hola {{nombe}}', body: 'Texto de prueba largo' }, ANDRES))).toBe(HttpCode.BAD_REQUEST);
    expect(await status(d.create({ name: 'primer CONTACTO', channel: 'WHATSAPP', body: 'Texto de prueba largo' }, ANDRES))).toBe(HttpCode.CONFLICT);
  });

  it('only its creator or an ADMIN can edit it', async () => {
    const r = repo();
    const d = new TemplatesDomain(r);
    expect(await status(d.update(1, { active: false }, CAMILA))).toBe(HttpCode.FORBIDDEN);
    await d.update(1, { active: false }, ADMIN);
    await d.update(1, { body: 'Nuevo texto {{remitente}}' }, ANDRES);
    expect(r.updateTemplate).toHaveBeenCalledTimes(2);
    expect(await status(d.update(1, { subject: '' }, ANDRES))).toBe(HttpCode.BAD_REQUEST);
    expect(await status(d.update(9, { active: false }, ADMIN))).toBe(HttpCode.NOT_FOUND);
  });
});

describe('capitalizeName', () => {
  it('normalizes uppercase names without breaking acronyms', () => {
    expect(capitalizeName('AUTODORADO TRANSPORTE ESPECIAL S.A.S.')).toBe('Autodorado Transporte Especial S.A.S.');
    expect(capitalizeName('PANAMERICANA DE VIAJES SAS PRINCIPAL')).toBe('Panamericana de Viajes SAS Principal');
    expect(capitalizeName('NH COLLECTION ROYAL TELEPORT')).toBe('NH Collection Royal Teleport');
    expect(capitalizeName('CAJACOPI UNIDAD PRADO')).toBe('Cajacopi Unidad Prado');
    expect(capitalizeName('BOGOTÁ, D.C.')).toBe('Bogotá, D.C.');
    expect(capitalizeName('ARCHIPIÉLAGO DE SAN ANDRÉS, PROVIDENCIA Y SANTA CATALINA')).toBe('Archipiélago de San Andrés, Providencia y Santa Catalina');
    expect(capitalizeName('LA 14 LTDA')).toBe('La 14 LTDA');
  });
  it('respects names that already come with their own casing', () => {
    expect(capitalizeName('Café de la Esquina')).toBe('Café de la Esquina');
  });
});
