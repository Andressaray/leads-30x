import { param, query } from 'express-validator';
import { FUENTES } from '~types/fuente.types';
import { ESTADOS_CONTACTO } from 'modules/contactos/types/contactos.types';
import { resolverDepartamento } from '~utils/divipola';

const booleano = (campo: string) =>
  query(campo).optional().isIn(['true', 'false', '1', '0', 'si', 'no']).withMessage(`${campo} debe ser true o false.`)
    .customSanitizer((v: string) => ['true', '1', 'si'].includes(String(v).toLowerCase()));

function filtros(maxLimite: number) {
  return [
  query('busqueda').optional().isInt({ min: 1 }).withMessage('busqueda debe ser un id numérico.').toInt(),
  query('municipio').optional().matches(/^\d{5}$/).withMessage('municipio debe ser un código DIVIPOLA de 5 dígitos.'),
  query('departamento')
    .optional()
    .custom((v) => Boolean(resolverDepartamento(v)))
    .withMessage('No reconozco ese departamento.')
    .customSanitizer((v) => resolverDepartamento(v)),
  query('categoria').optional().isString().trim().isLength({ max: 40 }),
  query('fuente').optional().isIn([...FUENTES]).withMessage(`fuente debe ser una de: ${FUENTES.join(', ')}.`),
  booleano('contactable'),
  booleano('contactado'),
  booleano('mios'),
  query('contactado_por').optional().isInt({ min: 1 }).withMessage('contactado_por debe ser el id de un usuario.').toInt(),
  query('estado')
    .optional()
    .customSanitizer((v: unknown) => String(v).split(',').map((x) => x.trim().toUpperCase()).filter(Boolean))
    .custom((xs: string[]) => xs.length > 0 && xs.every((x) => (ESTADOS_CONTACTO as readonly string[]).includes(x)))
    .withMessage(`estado debe ser uno o varios (separados por coma) de: ${ESTADOS_CONTACTO.join(', ')}.`),
  query('calidad')
    .optional()
    .customSanitizer((v: unknown) => String(v).split(',').map((x) => x.trim().toUpperCase()).filter(Boolean))
    .custom((xs: string[]) => xs.length > 0 && xs.every((x) => ['ALTA', 'MEDIA', 'BAJA', 'DESCARTADO', 'SIN'].includes(x)))
    .withMessage('calidad debe ser uno o varios (separados por coma) de: ALTA, MEDIA, BAJA, DESCARTADO, SIN (sin calificar).'),
  booleano('en_ambas'),
  booleano('personas_naturales'),
  query('q').optional().isString().trim().isLength({ min: 2, max: 100 }).withMessage('q debe tener entre 2 y 100 caracteres.'),
  query('limite').optional().isInt({ min: 1, max: maxLimite }).withMessage(`limite debe estar entre 1 y ${maxLimite}.`).toInt(),
  query('pagina').optional().isInt({ min: 1 }).withMessage('pagina debe ser 1 o mayor.').toInt(),
  ];
}

export const filtrosLeadsValidator = filtros(1000);
export const exportarLeadsValidator = filtros(100000);

export const idLeadValidator = [param('id').isInt({ min: 1 }).withMessage('El id del lead debe ser numérico.').toInt()];
