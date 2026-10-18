import { query } from 'express-validator';
import { resolverDepartamento } from '~utils/divipola';

export const municipiosValidator = [
  query('q').optional().isString().trim().isLength({ max: 80 }),
  query('departamento')
    .optional()
    .custom((v) => Boolean(resolverDepartamento(v)))
    .withMessage('No reconozco ese departamento.')
    .customSanitizer((v) => resolverDepartamento(v)),
  query('limite').optional().isInt({ min: 1, max: 1200 }).withMessage('limite debe estar entre 1 y 1200.').toInt(),
];
