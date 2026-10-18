import { body, param, query } from 'express-validator';
import { COST_CHANNELS } from '../types/costs.types';

const date = (field: string, location: typeof body | typeof query) =>
  location(field).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage(`${field} debe ser una fecha AAAA-MM-DD.`)
    .custom((v: string) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v))
    .withMessage(`${field} no es una fecha válida.`);

const channel = body('channel').customSanitizer((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v))
  .isIn([...COST_CHANNELS]).withMessage(`channel debe ser uno de: ${COST_CHANNELS.join(', ')}.`);
const type = body('type').customSanitizer((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v))
  .isIn(['EXPENSE', 'HOURS']).withMessage('type debe ser EXPENSE u HOURS.');
const description = body('description').isString().trim().isLength({ min: 2, max: 200 }).withMessage('description debe tener entre 2 y 200 caracteres.');
const number = (field: string, max: number) =>
  body(field).optional({ values: 'null' }).isFloat({ gt: 0, max }).withMessage(`${field} debe ser un número mayor a 0.`).toFloat();

export const listCostsValidator = [date('from', query).optional(), date('to', query).optional()];
export const costIdValidator = [param('id').isInt({ min: 1 }).withMessage('El id del costo debe ser numérico.').toInt()];

export const createCostValidator = [
  channel,
  type.optional(),
  description,
  number('amount', 1e12),
  number('hours', 1e5),
  number('hourlyRate', 1e9),
  date('from', body),
  date('to', body),
];

export const updateCostValidator = [
  ...costIdValidator,
  channel.optional(),
  type.optional(),
  description.optional(),
  number('amount', 1e12),
  number('hours', 1e5),
  number('hourlyRate', 1e9),
  date('from', body).optional(),
  date('to', body).optional(),
];
