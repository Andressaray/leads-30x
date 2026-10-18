/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: "Login. The token is sent in the Authorization header (Bearer) on every other route."
 *
 * components:
 *   schemas:
 *     SessionUser:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 1 }
 *         email: { type: string, example: andres@gmail.com }
 *         fullName: { type: string, example: Andres Saray }
 *         role: { type: string, enum: [SERVICE, ADMIN] }
 *     User:
 *       allOf:
 *         - $ref: '#/components/schemas/SessionUser'
 *         - type: object
 *           properties:
 *             active: { type: boolean }
 *             createdAt: { type: string, format: date-time }
 *             updatedAt: { type: string, format: date-time }
 *     Member:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 2 }
 *         fullName: { type: string, example: Camila Rojas }
 *         email: { type: string, example: camila@gmail.com }
 *         contacted: { type: integer, example: 12, description: Leads assigned to them because they pressed Contact }
 *
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Logs in with email and password
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
 *         description: Logged in
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 data:
 *                   type: object
 *                   properties:
 *                     token: { type: string, description: JWT for the Authorization header }
 *                     user: { $ref: '#/components/schemas/SessionUser' }
 *       400: { description: Missing data, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Wrong email or password, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       429: { description: Too many attempts, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Current session user
 *     responses:
 *       200:
 *         description: User
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 data: { $ref: '#/components/schemas/User' }
 *       401: { description: No session or expired session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /users:
 *   get:
 *     tags: [Auth]
 *     summary: Lists the users (ADMIN only)
 *     responses:
 *       200:
 *         description: Users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 data: { type: array, items: { $ref: '#/components/schemas/User' } }
 *       401: { description: No session or expired session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: The user is not ADMIN, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /users/members:
 *   get:
 *     tags: [Auth]
 *     summary: Team members (active users without the ADMIN role) with how many leads each one contacted
 *     description: "Any user with a session. Used to filter GET /leads?contacted=true&contacted_by=<id>."
 *     responses:
 *       200:
 *         description: Members sorted by name
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Member' } }
 *       401: { description: No session or expired session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
export const authDocs = 'auth';
