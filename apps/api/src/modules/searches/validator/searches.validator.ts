import { body, param, query } from 'express-validator';
import { SOURCES } from '~types/source.types';

/** Accepts an array or a comma separated text: ["4752"] | "4752,4663" */
const toList = (v: unknown) =>
  v === undefined || v === null || v === ''
    ? undefined
    : ([] as unknown[]).concat(v).flatMap((x) => String(x).split(',')).map((x) => x.trim()).filter(Boolean);

export const createSearchValidator = [
  body('city').if(body('code').not().exists()).exists({ values: 'falsy' }).withMessage('Envía "city" (y "department" si el nombre se repite) o "code".'),
  body('city').optional().isString().trim().isLength({ min: 2, max: 80 }).withMessage('city debe tener entre 2 y 80 caracteres.'),
  body('department').optional().isString().trim().isLength({ min: 1, max: 80 }).withMessage('department debe tener hasta 80 caracteres.'),
  body('code').optional().matches(/^\d{5}$/).withMessage('code debe ser un código DIVIPOLA de 5 dígitos.'),
  body('category').optional({ values: 'falsy' }).isString().trim().isLength({ max: 40 }),
  body('ciiu').optional().customSanitizer(toList).custom((xs: string[]) => xs.every((x) => /^\d{4}$/.test(x))).withMessage('ciiu debe ser una lista de códigos de 4 dígitos.'),
  body('osm').optional().customSanitizer(toList).custom((xs: string[]) => xs.every((x) => /^[a-z][a-z0-9_:]{0,40}(=[A-Za-z0-9_:-]{1,40})?$/.test(x))).withMessage('osm debe ser una lista de etiquetas clave=valor.'),
  body('sources').optional().customSanitizer(toList).custom((xs: string[]) => xs.length > 0 && xs.every((x) => (SOURCES as readonly string[]).includes(x))).withMessage(`sources debe ser una lista con: ${SOURCES.join(', ')}.`),
  body('includeIndividuals').optional().isBoolean().withMessage('includeIndividuals debe ser true o false.').toBoolean(),
  body('refresh').optional().isBoolean().withMessage('refresh debe ser true o false.').toBoolean(),
  body('async').optional().isBoolean().withMessage('async debe ser true o false.').toBoolean(),
  body('leadsLimit').optional().isInt({ min: 1, max: 5000 }).withMessage('leadsLimit debe estar entre 1 y 5000.').toInt(),
];

export const listSearchesValidator = [query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit debe estar entre 1 y 500.').toInt()];

export const searchIdValidator = [param('id').isInt({ min: 1 }).withMessage('El id de la búsqueda debe ser numérico.').toInt()];
