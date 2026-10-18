import { body, param, query } from 'express-validator';
import { CANALES_PLANTILLA } from '../types/plantillas.types';

const canal = (ubicacion: typeof body | typeof query) =>
  ubicacion('canal').customSanitizer((v) => (typeof v === 'string' ? v.toUpperCase() : v))
    .isIn([...CANALES_PLANTILLA]).withMessage(`canal debe ser uno de: ${CANALES_PLANTILLA.join(', ')}.`);

export const listarPlantillasValidator = [
  canal(query).optional(),
  query('inactivas').optional().isBoolean().withMessage('inactivas debe ser true o false.').toBoolean(),
];

export const idPlantillaValidator = [param('id').isInt({ min: 1 }).withMessage('El id de la plantilla debe ser numérico.').toInt()];

export const crearPlantillaValidator = [
  body('nombre').isString().trim().isLength({ min: 2, max: 80 }).withMessage('nombre debe tener entre 2 y 80 caracteres.'),
  canal(body),
  body('asunto').optional({ values: 'null' }).isString().trim().isLength({ max: 150 }).withMessage('asunto debe tener hasta 150 caracteres.'),
  body('cuerpo').isString().trim().isLength({ min: 10, max: 5000 }).withMessage('cuerpo debe tener entre 10 y 5000 caracteres.'),
];

export const actualizarPlantillaValidator = [
  ...idPlantillaValidator,
  body('nombre').optional().isString().trim().isLength({ min: 2, max: 80 }).withMessage('nombre debe tener entre 2 y 80 caracteres.'),
  body('asunto').optional({ values: 'null' }).isString().trim().isLength({ max: 150 }).withMessage('asunto debe tener hasta 150 caracteres.'),
  body('cuerpo').optional().isString().trim().isLength({ min: 10, max: 5000 }).withMessage('cuerpo debe tener entre 10 y 5000 caracteres.'),
  body('activa').optional().isBoolean({ strict: true }).withMessage('activa debe ser true o false.'),
];
