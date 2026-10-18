/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: "Inicio de sesión. El token se manda en el header Authorization (Bearer) en el resto de rutas."
 *
 * components:
 *   schemas:
 *     UsuarioSesion:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 1 }
 *         email: { type: string, example: andres@gmail.com }
 *         fullName: { type: string, example: Andres Saray }
 *         rol: { type: string, enum: [SERVICE, ADMIN] }
 *     Usuario:
 *       allOf:
 *         - $ref: '#/components/schemas/UsuarioSesion'
 *         - type: object
 *           properties:
 *             activo: { type: boolean }
 *             createdAt: { type: string, format: date-time }
 *             updatedAt: { type: string, format: date-time }
 *     Miembro:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 2 }
 *         fullName: { type: string, example: Camila Rojas }
 *         email: { type: string, example: camila@gmail.com }
 *         contactados: { type: integer, example: 12, description: Leads que tiene asignados por haberles dado Contactar }
 *
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Inicia sesión con correo y contraseña
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: andres@gmail.com }
 *               password: { type: string, example: 'Andres1234*' }
 *     responses:
 *       200:
 *         description: Sesión iniciada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 data:
 *                   type: object
 *                   properties:
 *                     token: { type: string, description: JWT para el header Authorization }
 *                     usuario: { $ref: '#/components/schemas/UsuarioSesion' }
 *       400: { description: Faltan datos, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Correo o contraseña incorrectos, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       429: { description: Demasiados intentos, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Usuario de la sesión actual
 *     responses:
 *       200:
 *         description: Usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 data: { $ref: '#/components/schemas/Usuario' }
 *       401: { description: Sin sesión o sesión vencida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /usuarios:
 *   get:
 *     tags: [Auth]
 *     summary: Lista los usuarios (solo ADMIN)
 *     responses:
 *       200:
 *         description: Usuarios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Usuario' } }
 *       401: { description: Sin sesión o sesión vencida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: El usuario no es ADMIN, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /usuarios/miembros:
 *   get:
 *     tags: [Auth]
 *     summary: Miembros del equipo (usuarios activos sin rol ADMIN) con cuántos leads contactó cada uno
 *     description: "Cualquier usuario con sesión. Sirve para filtrar GET /leads?contactado=true&contactado_por=<id>."
 *     responses:
 *       200:
 *         description: Miembros ordenados por nombre
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Miembro' } }
 *       401: { description: Sin sesión o sesión vencida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
export const authDocs = 'auth';
