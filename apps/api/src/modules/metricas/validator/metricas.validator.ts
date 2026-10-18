import { query } from 'express-validator';

const fecha = (campo: string) =>
  query(campo).optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage(`${campo} debe ser una fecha AAAA-MM-DD.`)
    .custom((v: string) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v))
    .withMessage(`${campo} no es una fecha válida.`);

export const metricasValidator = [fecha('desde'), fecha('hasta')];
