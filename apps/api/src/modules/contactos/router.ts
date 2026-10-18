import { bajasController, contactosController } from './controller/contactos.controller';

/** Rutas con sesión, bajo /api/leads/:id/… */
export const ContactosRouter = contactosController;
/** Enlace público de baja de los correos (sin sesión), bajo /api/bajas. */
export const BajasRouter = bajasController;
