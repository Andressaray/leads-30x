import { Router, type Request, type Response } from 'express';
import { matchedData } from 'express-validator';
import { AppError, HttpCode, handleError, handleFile, handleSuccess, handleValidator } from '~response/index';
import { LeadsDomain } from '../domain/leads.domain';
import type { FiltrosLeadsDTO } from '../types/leads.types';
import { exportarLeadsValidator, filtrosLeadsValidator, idLeadValidator } from '../validator/leads.validator';

const leadsDomain = new LeadsDomain();
export const leadsController = Router();

function responderError(res: Response, error: unknown): void {
  if (error instanceof AppError) handleError(res, error.status, error.message, error.details);
  else handleError(res, HttpCode.INTERNAL_SERVER_ERROR, 'Unknown error');
}

function aFiltros(req: Request, limitePorDefecto: number): FiltrosLeadsDTO {
  const d = matchedData(req, { locations: ['query'] });
  // mios=true → solo los que contactó el usuario de la sesión; contactado_por=<id> → los de esa persona.
  const contactadoPorId = d.mios ? req.usuario!.id : d.contactado_por;
  return {
    busquedaId: d.busqueda,
    codMpio: d.municipio,
    codDpto: d.departamento,
    categoria: d.categoria,
    fuente: d.fuente,
    contactable: d.contactable,
    contactado: d.contactado,
    contactadoPorId,
    estados: d.estado,
    calidades: d.calidad,
    enAmbas: d.en_ambas,
    personasNaturales: d.personas_naturales,
    q: d.q,
    limite: d.limite ?? limitePorDefecto,
    pagina: d.pagina ?? 1,
  };
}

leadsController.get('/', [...filtrosLeadsValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await leadsDomain.listar(aFiltros(req, 100)));
  } catch (error: unknown) {
    responderError(res, error);
  }
});

leadsController.post('/:id/contactar', [...idLeadValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    handleSuccess(res, HttpCode.OK, await leadsDomain.marcarContactado(id, req.usuario!.id));
  } catch (error: unknown) {
    responderError(res, error);
  }
});

leadsController.get('/export.csv', [...exportarLeadsValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const csv = await leadsDomain.exportarCsv(aFiltros(req, 100000));
    handleFile(res, 'leads.csv', 'text/csv; charset=utf-8', csv);
  } catch (error: unknown) {
    responderError(res, error);
  }
});

leadsController.get('/estadisticas', async (_req: Request, res: Response) => {
  try {
    handleSuccess(res, HttpCode.OK, await leadsDomain.estadisticas());
  } catch (error: unknown) {
    responderError(res, error);
  }
});

leadsController.get('/:id', [...idLeadValidator, handleValidator], async (req: Request, res: Response) => {
  try {
    const { id } = matchedData(req, { locations: ['params'] });
    handleSuccess(res, HttpCode.OK, await leadsDomain.obtener(id));
  } catch (error: unknown) {
    responderError(res, error);
  }
});
