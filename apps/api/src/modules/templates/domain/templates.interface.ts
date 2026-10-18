import type { SessionUser } from '~types/auth.types';
import type { CreateTemplateDTO, TemplateFiltersDTO, TemplateDTO, UpdateTemplateDTO } from '../types/templates.types';

export interface TemplatesDomainInterface {
  list(filters: TemplateFiltersDTO): Promise<TemplateDTO[]>;
  /** Throws 404 if it does not exist. */
  get(id: number): Promise<TemplateDTO>;
  /** Throws 400 if it uses variables that do not exist or if it is an email without a subject; 409 if the name already exists. */
  create(dto: Omit<CreateTemplateDTO, 'createdById'>, user: SessionUser): Promise<TemplateDTO>;
  /** Only its creator or an ADMIN (403). Deactivate = active: false. */
  update(id: number, dto: UpdateTemplateDTO, user: SessionUser): Promise<TemplateDTO>;
}
