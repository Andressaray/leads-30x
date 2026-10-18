import { body, param, query } from 'express-validator';
import { FUENTES } from '~types/fuente.types';

/** Acepta un arreglo o un texto separado por comas: ["4752"] | "4752,4663" */
const aLista = (v: unknown) =>
  v === undefined || v === null || v === ''
    ? undefined
    : ([] as unknown[]).concat(v).flatMap((x) => String(x).split(',')).map((x) => x.trim()).filter(Boolean);

export const crearBusquedaValidator = [
  body('ciudad').if(body('codigo').not().exists()).exists({ values: 'falsy' }).withMessage('Envía "ciudad" (y "departamento" si el nombre se repite) o "codigo".'),
  body('ciudad').optional().isString().trim().isLength({ min: 2, max: 80 }).withMessage('ciudad debe tener entre 2 y 80 caracteres.'),
  body('departamento').optional().isString().trim().isLength({ min: 1, max: 80 }).withMessage('departamento debe tener hasta 80 caracteres.'),
  body('codigo').optional().matches(/^\d{5}$/).withMessage('codigo debe ser un código DIVIPOLA de 5 dígitos.'),
  body('categoria').optional({ values: 'falsy' }).isString().trim().isLength({ max: 40 }),
  body('ciiu').optional().customSanitizer(aLista).custom((xs: string[]) => xs.every((x) => /^\d{4}$/.test(x))).withMessage('ciiu debe ser una lista de códigos de 4 dígitos.'),
  body('osm').optional().customSanitizer(aLista).custom((xs: string[]) => xs.every((x) => /^[a-z][a-z0-9_:]{0,40}(=[A-Za-z0-9_:-]{1,40})?$/.test(x))).withMessage('osm debe ser una lista de etiquetas clave=valor.'),
  body('fuentes').optional().customSanitizer(aLista).custom((xs: string[]) => xs.length > 0 && xs.every((x) => (FUENTES as readonly string[]).includes(x))).withMessage(`fuentes debe ser una lista con: ${FUENTES.join(', ')}.`),
  body('incluirPersonasNaturales').optional().isBoolean().withMessage('incluirPersonasNaturales debe ser true o false.').toBoolean(),
  body('refrescar').optional().isBoolean().withMessage('refrescar debe ser true o false.').toBoolean(),
  body('asincrona').optional().isBoolean().withMessage('asincrona debe ser true o false.').toBoolean(),
  body('limiteLeads').optional().isInt({ min: 1, max: 5000 }).withMessage('limiteLeads debe estar entre 1 y 5000.').toInt(),
];

export const listarBusquedasValidator = [query('limite').optional().isInt({ min: 1, max: 500 }).withMessage('limite debe estar entre 1 y 500.').toInt()];

export const idBusquedaValidator = [param('id').isInt({ min: 1 }).withMessage('El id de la búsqueda debe ser numérico.').toInt()];
