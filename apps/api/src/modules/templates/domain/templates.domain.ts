// Message template rules: valid variables, subject required for email,
// unique names and who can edit them.
import * as realRepository from '../repository/templates.repository';
import { AppError, HttpCode } from '~response/index';
import type { SessionUser } from '~types/auth.types';
import type { TemplatesDomainInterface } from './templates.interface';
import { PLACEHOLDERS, unknownVariables } from './templates.render';
import type { CreateTemplateDTO, TemplateFiltersDTO, TemplateDTO, UpdateTemplateDTO } from '../types/templates.types';

export type TemplatesRepository = typeof realRepository;

function validateVariables(...texts: (string | null | undefined)[]): void {
  const bad = [...new Set(texts.flatMap((t) => (t ? unknownVariables(t) : [])))];
  if (bad.length) {
    throw new AppError(
      HttpCode.BAD_REQUEST,
      `Variable desconocida: ${bad.map((m) => `{{${m}}}`).join(', ')}. Usa: ${Object.values(PLACEHOLDERS).map((v) => `{{${v}}}`).join(', ')}.`,
      { field: 'body', unknown: bad }
    );
  }
}

export class TemplatesDomain implements TemplatesDomainInterface {
  constructor(private readonly repo: TemplatesRepository = realRepository) {}

  list(filters: TemplateFiltersDTO): Promise<TemplateDTO[]> {
    return this.repo.findTemplates(filters);
  }

  async get(id: number): Promise<TemplateDTO> {
    const p = await this.repo.findTemplate(id);
    if (!p) throw new AppError(HttpCode.NOT_FOUND, 'Plantilla no encontrada.');
    return p;
  }

  async create(dto: Omit<CreateTemplateDTO, 'createdById'>, user: SessionUser): Promise<TemplateDTO> {
    const subject = dto.channel === 'EMAIL' ? dto.subject?.trim() || null : null;
    if (dto.channel === 'EMAIL' && !subject) {
      throw new AppError(HttpCode.BAD_REQUEST, 'Las plantillas de correo necesitan un asunto.', { field: 'subject' });
    }
    validateVariables(subject, dto.body);
    await this.isNameFree(dto.name);
    return this.repo.createTemplate({ ...dto, subject, createdById: user.id });
  }

  async update(id: number, dto: UpdateTemplateDTO, user: SessionUser): Promise<TemplateDTO> {
    const current = await this.get(id);
    if (user.role !== 'ADMIN' && current.createdById !== user.id) {
      throw new AppError(HttpCode.FORBIDDEN, 'Solo quien creó la plantilla o un administrador puede cambiarla.');
    }
    const changes: UpdateTemplateDTO = { ...dto };
    if (current.channel !== 'EMAIL') delete changes.subject;
    else if (changes.subject !== undefined && !changes.subject?.trim()) {
      throw new AppError(HttpCode.BAD_REQUEST, 'Las plantillas de correo necesitan un asunto.', { field: 'subject' });
    }
    validateVariables(changes.subject, changes.body);
    if (changes.name && changes.name.toLowerCase() !== current.name.toLowerCase()) await this.isNameFree(changes.name);
    return this.repo.updateTemplate(id, changes);
  }

  private async isNameFree(name: string): Promise<void> {
    if (await this.repo.findTemplateByName(name)) {
      throw new AppError(HttpCode.CONFLICT, `Ya existe una plantilla llamada "${name}".`, { field: 'name' });
    }
  }
}
