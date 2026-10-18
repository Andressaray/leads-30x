import { param, query } from 'express-validator';
import { SOURCES } from '~types/source.types';
import { CONTACT_STATUSES } from 'modules/outreach/types/outreach.types';
import { resolveDepartment } from '~utils/divipola';

const boolean = (field: string) =>
  query(field).optional().isIn(['true', 'false', '1', '0', 'si', 'no']).withMessage(`${field} debe ser true o false.`)
    .customSanitizer((v: string) => ['true', '1', 'si'].includes(String(v).toLowerCase()));

function filters(maxLimit: number) {
  return [
  query('search').optional().isInt({ min: 1 }).withMessage('search debe ser un id numérico.').toInt(),
  query('municipality').optional().matches(/^\d{5}$/).withMessage('municipality debe ser un código DIVIPOLA de 5 dígitos.'),
  query('department')
    .optional()
    .custom((v) => Boolean(resolveDepartment(v)))
    .withMessage('No reconozco ese departamento.')
    .customSanitizer((v) => resolveDepartment(v)),
  query('category').optional().isString().trim().isLength({ max: 40 }),
  query('source').optional().isIn([...SOURCES]).withMessage(`source debe ser una de: ${SOURCES.join(', ')}.`),
  boolean('contactable'),
  boolean('contacted'),
  boolean('mine'),
  query('contacted_by').optional().isInt({ min: 1 }).withMessage('contacted_by debe ser el id de un usuario.').toInt(),
  query('status')
    .optional()
    .customSanitizer((v: unknown) => String(v).split(',').map((x) => x.trim().toUpperCase()).filter(Boolean))
    .custom((xs: string[]) => xs.length > 0 && xs.every((x) => (CONTACT_STATUSES as readonly string[]).includes(x)))
    .withMessage(`status debe ser uno o varios (separados por coma) de: ${CONTACT_STATUSES.join(', ')}.`),
  query('quality')
    .optional()
    .customSanitizer((v: unknown) => String(v).split(',').map((x) => x.trim().toUpperCase()).filter(Boolean))
    .custom((xs: string[]) => xs.length > 0 && xs.every((x) => ['HIGH', 'MEDIUM', 'LOW', 'DISCARDED', 'NONE'].includes(x)))
    .withMessage('quality debe ser uno o varios (separados por coma) de: HIGH, MEDIUM, LOW, DISCARDED, NONE (sin calificar).'),
  boolean('in_both'),
  boolean('individuals'),
  query('q').optional().isString().trim().isLength({ min: 2, max: 100 }).withMessage('q debe tener entre 2 y 100 caracteres.'),
  query('limit').optional().isInt({ min: 1, max: maxLimit }).withMessage(`limit debe estar entre 1 y ${maxLimit}.`).toInt(),
  query('page').optional().isInt({ min: 1 }).withMessage('page debe ser 1 o mayor.').toInt(),
  ];
}

export const leadFiltersValidator = filters(1000);
export const exportLeadsValidator = filters(100000);

export const idLeadValidator = [param('id').isInt({ min: 1 }).withMessage('El id del lead debe ser numérico.').toInt()];
