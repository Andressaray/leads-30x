import { query } from 'express-validator';
import { resolveDepartment } from '~utils/divipola';

export const municipalitiesValidator = [
  query('q').optional().isString().trim().isLength({ max: 80 }),
  query('department')
    .optional()
    .custom((v) => Boolean(resolveDepartment(v)))
    .withMessage('No reconozco ese departamento.')
    .customSanitizer((v) => resolveDepartment(v)),
  query('limit').optional().isInt({ min: 1, max: 1200 }).withMessage('limit debe estar entre 1 y 1200.').toInt(),
];
