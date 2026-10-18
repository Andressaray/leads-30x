import { Router, type Request, type Response } from 'express';
import { matchedData } from 'express-validator';
import { AppError, HttpCode, handleError, handleFile, handleSuccess, handleValidator } from '~response/index';
import { LeadsDomain } from '../domain/leads.domain';
import type { LeadFiltersDTO } from '../types/leads.types';
import { exportLeadsValidator, leadFiltersValidator, idLeadValidator } from '../validator/leads.validator';

const leadsDomain = new LeadsDomain();
export const leadsController = Router();

function respondError(res: Response, error: unknown): void {
  if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
  else handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
}

function toFilters(req: Request, defaultLimit: number): LeadFiltersDTO {
  const d = matchedData(req, { locations: ['query'] });
  // mine=true → only the ones contacted by the session user; contacted_by=<id> → that person's.
  const contactedById = d.mine ? req.user!.id : d.contacted_by;
  return {
    searchId: d.search,
    municipalityCode: d.municipality,
    departmentCode: d.department,
    category: d.category,
    source: d.source,
    contactable: d.contactable,
    contacted: d.contacted,
    contactedById,
    statuses: d.status,
    qualities: d.quality,
    inBoth: d.in_both,
    individuals: d.individuals,
    q: d.q,
    limit: d.limit ?? defaultLimit,
    page: d.page ?? 1,
  };
}

leadsController.get('/', [...leadFiltersValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await leadsDomain.list(toFilters(req, 100)));
  } catch (error: unknown) {
    respondError(res, error);
  }
});

leadsController.post('/:id/mark-contacted', [...idLeadValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    handleSuccess(res, HttpCode.OK, await leadsDomain.markContacted(id, req.user!.id));
  } catch (error: unknown) {
    respondError(res, error);
  }
});

leadsController.get('/export.csv', [...exportLeadsValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const csv = await leadsDomain.exportCsv(toFilters(req, 100000));
    handleFile(res, 'leads.csv', 'text/csv; charset=utf-8', csv);
  } catch (error: unknown) {
    respondError(res, error);
  }
});

leadsController.get('/stats', async (_req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await leadsDomain.stats());
  } catch (error: unknown) {
    respondError(res, error);
  }
});

leadsController.get('/:id', [...idLeadValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    handleSuccess(res, HttpCode.OK, await leadsDomain.get(id));
  } catch (error: unknown) {
    respondError(res, error);
  }
});
