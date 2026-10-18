import { body, param } from 'express-validator';
import { CALIDADES } from '../types/calificaciones.types';
import { MAX_LOTE } from '../domain/calificaciones.domain';

export const idLeadValidator = [param('id').isInt({ min: 1 }).withMessage('El id del lead debe ser numérico.').toInt()];

export const loteValidator = [
  body('leadIds').isArray({ min: 1, max: MAX_LOTE }).withMessage(`leadIds debe ser una lista de 1 a ${MAX_LOTE} ids.`),
  body('leadIds.*').isInt({ min: 1 }).withMessage('Cada id de lead debe ser numérico.').toInt(),
];

export const calificarManualValidator = [
  ...idLeadValidator,
  body('calidad').customSanitizer((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v))
    .isIn([...CALIDADES]).withMessage(`calidad debe ser una de: ${CALIDADES.join(', ')}.`),
  body('puntaje').optional({ values: 'null' }).isInt({ min: 0, max: 100 }).withMessage('puntaje debe estar entre 0 y 100.').toInt(),
  body('nota').optional().isString().trim().isLength({ max: 1000 }).withMessage('nota debe tener hasta 1000 caracteres.'),
];
