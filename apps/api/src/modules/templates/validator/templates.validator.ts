import { body, param, query } from 'express-validator';
import { TEMPLATE_CHANNELS } from '../types/templates.types';

const channel = (location: typeof body | typeof query) =>
  location('channel').customSanitizer((v) => (typeof v === 'string' ? v.toUpperCase() : v))
    .isIn([...TEMPLATE_CHANNELS]).withMessage(`channel debe ser uno de: ${TEMPLATE_CHANNELS.join(', ')}.`);

export const listTemplatesValidator = [
  channel(query).optional(),
  query('inactive').optional().isBoolean().withMessage('inactive debe ser true o false.').toBoolean(),
];

export const templateIdValidator = [param('id').isInt({ min: 1 }).withMessage('El id de la plantilla debe ser numérico.').toInt()];

export const createTemplateValidator = [
  body('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('name debe tener entre 2 y 80 caracteres.'),
  channel(body),
  body('subject').optional({ values: 'null' }).isString().trim().isLength({ max: 150 }).withMessage('subject debe tener hasta 150 caracteres.'),
  body('body').isString().trim().isLength({ min: 10, max: 5000 }).withMessage('body debe tener entre 10 y 5000 caracteres.'),
];

export const updateTemplateValidator = [
  ...templateIdValidator,
  body('name').optional().isString().trim().isLength({ min: 2, max: 80 }).withMessage('name debe tener entre 2 y 80 caracteres.'),
  body('subject').optional({ values: 'null' }).isString().trim().isLength({ max: 150 }).withMessage('subject debe tener hasta 150 caracteres.'),
  body('body').optional().isString().trim().isLength({ min: 10, max: 5000 }).withMessage('body debe tener entre 10 y 5000 caracteres.'),
  body('active').optional().isBoolean({ strict: true }).withMessage('active debe ser true o false.'),
];
