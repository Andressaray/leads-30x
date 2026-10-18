import { query } from 'express-validator';

const date = (field: string) =>
  query(field).optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage(`${field} debe ser una fecha AAAA-MM-DD.`)
    .custom((v: string) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v))
    .withMessage(`${field} no es una fecha válida.`);

export const metricsValidator = [date('from'), date('to')];
