import { body } from 'express-validator';

export const loginValidator = [
  body('email').isString().trim().toLowerCase().isEmail().withMessage('Escribe un correo válido.').isLength({ max: 200 }),
  body('password').isString().withMessage('Escribe la contraseña.').isLength({ min: 1, max: 200 }).withMessage('Escribe la contraseña.'),
];
