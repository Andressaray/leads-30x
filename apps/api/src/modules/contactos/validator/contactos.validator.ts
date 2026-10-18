import { body, param } from 'express-validator';
import { CANALES, CANALES_MANUALES, RESULTADOS_RESPUESTA } from '../types/contactos.types';

const mayusculas = (v: unknown) => (typeof v === 'string' ? v.trim().toUpperCase() : v);

export const idLeadValidator = [param('id').isInt({ min: 1 }).withMessage('El id del lead debe ser numérico.').toInt()];

const plantillaId = body('plantillaId').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('plantillaId debe ser numérico.').toInt();

export const vistaPreviaValidator = [
  ...idLeadValidator,
  plantillaId,
  body('asunto').optional().isString().isLength({ max: 150 }).withMessage('asunto debe tener hasta 150 caracteres.'),
  body('cuerpo').optional().isString().isLength({ max: 5000 }).withMessage('cuerpo debe tener hasta 5000 caracteres.'),
  body().custom((b) => Boolean(b?.plantillaId || b?.cuerpo)).withMessage('Envía plantillaId o cuerpo.'),
];

export const enviarCorreoValidator = [
  ...idLeadValidator,
  body('para').optional().isEmail().withMessage('para debe ser un correo.'),
  body('asunto').isString().trim().isLength({ min: 3, max: 150 }).withMessage('asunto debe tener entre 3 y 150 caracteres.'),
  body('mensaje').isString().trim().isLength({ min: 10, max: 5000 }).withMessage('mensaje debe tener entre 10 y 5000 caracteres.'),
  plantillaId,
];

export const registrarContactoValidator = [
  ...idLeadValidator,
  body('canal').customSanitizer(mayusculas).isIn([...CANALES_MANUALES])
    .withMessage(`canal debe ser uno de: ${CANALES_MANUALES.join(', ')} (el correo se envía con /correo).`),
  body('destino').optional().isString().trim().isLength({ max: 40 }),
  body('mensaje').optional().isString().trim().isLength({ max: 5000 }).withMessage('mensaje debe tener hasta 5000 caracteres.'),
  body('nota').optional().isString().trim().isLength({ max: 1000 }).withMessage('nota debe tener hasta 1000 caracteres.'),
  plantillaId,
];

export const registrarRespuestaValidator = [
  ...idLeadValidator,
  body('canal').customSanitizer(mayusculas).isIn([...CANALES]).withMessage(`canal debe ser uno de: ${CANALES.join(', ')}.`),
  body('resultado').customSanitizer(mayusculas).isIn([...RESULTADOS_RESPUESTA])
    .withMessage(`resultado debe ser uno de: ${RESULTADOS_RESPUESTA.join(', ')}.`),
  body('nota').optional().isString().trim().isLength({ max: 1000 }).withMessage('nota debe tener hasta 1000 caracteres.'),
];

export const noContactarValidator = [
  ...idLeadValidator,
  body('nota').optional().isString().trim().isLength({ max: 1000 }).withMessage('nota debe tener hasta 1000 caracteres.'),
];

export const tokenBajaValidator = [param('token').isString().isLength({ min: 10, max: 60 }).withMessage('Enlace inválido.')];
