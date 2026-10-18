import { body, param, query } from 'express-validator';
import { CANALES_COSTO } from '../types/costos.types';

const fecha = (campo: string, ubicacion: typeof body | typeof query) =>
  ubicacion(campo).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage(`${campo} debe ser una fecha AAAA-MM-DD.`)
    .custom((v: string) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v))
    .withMessage(`${campo} no es una fecha válida.`);

const canal = body('canal').customSanitizer((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v))
  .isIn([...CANALES_COSTO]).withMessage(`canal debe ser uno de: ${CANALES_COSTO.join(', ')}.`);
const tipo = body('tipo').customSanitizer((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v))
  .isIn(['GASTO', 'HORAS']).withMessage('tipo debe ser GASTO u HORAS.');
const descripcion = body('descripcion').isString().trim().isLength({ min: 2, max: 200 }).withMessage('descripcion debe tener entre 2 y 200 caracteres.');
const numero = (campo: string, max: number) =>
  body(campo).optional({ values: 'null' }).isFloat({ gt: 0, max }).withMessage(`${campo} debe ser un número mayor a 0.`).toFloat();

export const listarCostosValidator = [fecha('desde', query).optional(), fecha('hasta', query).optional()];
export const idCostoValidator = [param('id').isInt({ min: 1 }).withMessage('El id del costo debe ser numérico.').toInt()];

export const crearCostoValidator = [
  canal,
  tipo.optional(),
  descripcion,
  numero('monto', 1e12),
  numero('horas', 1e5),
  numero('valorHora', 1e9),
  fecha('desde', body),
  fecha('hasta', body),
];

export const actualizarCostoValidator = [
  ...idCostoValidator,
  canal.optional(),
  tipo.optional(),
  descripcion.optional(),
  numero('monto', 1e12),
  numero('horas', 1e5),
  numero('valorHora', 1e9),
  fecha('desde', body).optional(),
  fecha('hasta', body).optional(),
];
