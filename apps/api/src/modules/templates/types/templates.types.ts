export const TEMPLATE_CHANNELS = ['EMAIL', 'WHATSAPP', 'CALL'] as const;
export type TemplateChannel = (typeof TEMPLATE_CHANNELS)[number];

export interface TemplateDTO {
  id: number;
  name: string;
  channel: TemplateChannel;
  /** Email only. */
  subject: string | null;
  body: string;
  active: boolean;
  createdById: number | null;
  createdBy?: { id: number; fullName: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateDTO {
  name: string;
  channel: TemplateChannel;
  subject?: string | null;
  body: string;
  createdById: number | null;
}

export type UpdateTemplateDTO = Partial<Pick<TemplateDTO, 'name' | 'subject' | 'body' | 'active'>>;

export interface TemplateFiltersDTO {
  channel?: TemplateChannel;
  includeInactive?: boolean;
}

/** Values used to fill a template's {{...}} variables. */
export interface TemplateVariables {
  name: string;
  municipality: string;
  department: string;
  category: string;
  sender: string;
  company: string;
}
