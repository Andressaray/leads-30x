import { body, param } from 'express-validator';
import { QUALITIES } from '../types/qualifications.types';
import { MAX_BATCH } from '../domain/qualifications.domain';

export const idLeadValidator = [param('id').isInt({ min: 1 }).withMessage('El id del lead debe ser numérico.').toInt()];

export const batchValidator = [
  body('leadIds').isArray({ min: 1, max: MAX_BATCH }).withMessage(`leadIds debe ser una lista de 1 a ${MAX_BATCH} ids.`),
  body('leadIds.*').isInt({ min: 1 }).withMessage('Cada id de lead debe ser numérico.').toInt(),
];

export const qualifyManuallyValidator = [
  ...idLeadValidator,
  body('quality').customSanitizer((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v))
    .isIn([...QUALITIES]).withMessage(`quality debe ser una de: ${QUALITIES.join(', ')}.`),
  body('score').optional({ values: 'null' }).isInt({ min: 0, max: 100 }).withMessage('score debe estar entre 0 y 100.').toInt(),
  body('note').optional().isString().trim().isLength({ max: 1000 }).withMessage('note debe tener hasta 1000 caracteres.'),
];
