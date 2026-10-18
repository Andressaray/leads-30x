import { body, param } from 'express-validator';
import { CHANNELS, MANUAL_CHANNELS, REPLY_RESULTS } from '../types/outreach.types';

const uppercase = (v: unknown) => (typeof v === 'string' ? v.trim().toUpperCase() : v);

export const idLeadValidator = [param('id').isInt({ min: 1 }).withMessage('El id del lead debe ser numérico.').toInt()];

const templateId = body('templateId').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('templateId debe ser numérico.').toInt();

export const previewValidator = [
  ...idLeadValidator,
  templateId,
  body('subject').optional().isString().isLength({ max: 150 }).withMessage('subject debe tener hasta 150 caracteres.'),
  body('body').optional().isString().isLength({ max: 5000 }).withMessage('body debe tener hasta 5000 caracteres.'),
  body().custom((b) => Boolean(b?.templateId || b?.body)).withMessage('Envía templateId o body.'),
];

export const sendEmailValidator = [
  ...idLeadValidator,
  body('to').optional().isEmail().withMessage('to debe ser un correo.'),
  body('subject').isString().trim().isLength({ min: 3, max: 150 }).withMessage('subject debe tener entre 3 y 150 caracteres.'),
  body('message').isString().trim().isLength({ min: 10, max: 5000 }).withMessage('message debe tener entre 10 y 5000 caracteres.'),
  templateId,
];

export const recordContactValidator = [
  ...idLeadValidator,
  body('channel').customSanitizer(uppercase).isIn([...MANUAL_CHANNELS])
    .withMessage(`channel debe ser uno de: ${MANUAL_CHANNELS.join(', ')} (el correo se envía con /email).`),
  body('destination').optional().isString().trim().isLength({ max: 40 }),
  body('message').optional().isString().trim().isLength({ max: 5000 }).withMessage('message debe tener hasta 5000 caracteres.'),
  body('note').optional().isString().trim().isLength({ max: 1000 }).withMessage('note debe tener hasta 1000 caracteres.'),
  templateId,
];

export const recordReplyValidator = [
  ...idLeadValidator,
  body('channel').customSanitizer(uppercase).isIn([...CHANNELS]).withMessage(`channel debe ser uno de: ${CHANNELS.join(', ')}.`),
  body('result').customSanitizer(uppercase).isIn([...REPLY_RESULTS])
    .withMessage(`result debe ser uno de: ${REPLY_RESULTS.join(', ')}.`),
  body('note').optional().isString().trim().isLength({ max: 1000 }).withMessage('note debe tener hasta 1000 caracteres.'),
];

export const doNotContactValidator = [
  ...idLeadValidator,
  body('note').optional().isString().trim().isLength({ max: 1000 }).withMessage('note debe tener hasta 1000 caracteres.'),
];

export const unsubscribeTokenValidator = [param('token').isString().isLength({ min: 10, max: 60 }).withMessage('Enlace inválido.')];
