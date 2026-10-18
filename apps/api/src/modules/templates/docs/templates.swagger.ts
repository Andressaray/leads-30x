/**
 * @swagger
 * tags:
 *   - name: Templates
 *     description: Reusable messages to contact leads (email, WhatsApp and call script)
 *
 * components:
 *   schemas:
 *     Template:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 1 }
 *         name: { type: string, example: 'Primer contacto por correo' }
 *         channel: { type: string, enum: [EMAIL, WHATSAPP, CALL] }
 *         subject: { type: string, nullable: true, example: 'Una propuesta para {{nombre}}' }
 *         body: { type: string, example: 'Hola, equipo de {{nombre}}. Vimos su negocio en {{municipio}}…' }
 *         active: { type: boolean }
 *         createdById: { type: integer, nullable: true }
 *         createdBy: { type: object, nullable: true, properties: { id: { type: integer }, fullName: { type: string } } }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *
 * /templates:
 *   get:
 *     tags: [Templates]
 *     summary: Active templates (or all of them with inactive=true)
 *     parameters:
 *       - { in: query, name: channel, schema: { type: string, enum: [EMAIL, WHATSAPP, CALL] } }
 *       - { in: query, name: inactive, schema: { type: boolean } }
 *     responses:
 *       200:
 *         description: Template list
 *         content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { type: array, items: { $ref: '#/components/schemas/Template' } } } } } }
 *       400: { description: Invalid filter, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session or expired session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *   post:
 *     tags: [Templates]
 *     summary: Creates a template
 *     description: 'Available variables (written in Spanish because the team types them in its messages): {{nombre}}, {{municipio}}, {{departamento}}, {{categoria}}, {{remitente}}, {{empresa}}. Email templates need a subject.'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, channel, body]
 *             properties:
 *               name: { type: string }
 *               channel: { type: string, enum: [EMAIL, WHATSAPP, CALL] }
 *               subject: { type: string }
 *               body: { type: string }
 *     responses:
 *       201: { description: Created, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/Template' } } } } } }
 *       400: { description: Invalid data, unknown variable or email without subject, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       409: { description: A template with that name already exists, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /templates/variables:
 *   get:
 *     tags: [Templates]
 *     summary: Variables that can be used in templates
 *     responses:
 *       200: { description: 'List of { name, description } (name is the placeholder, e.g. "nombre")' }
 *       401: { description: No session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /templates/{id}:
 *   get:
 *     tags: [Templates]
 *     summary: A template
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: The template, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/Template' } } } } } }
 *       400: { description: Invalid id, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Does not exist, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *   patch:
 *     tags: [Templates]
 *     summary: Edits or deactivates a template (its creator or an ADMIN)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               subject: { type: string }
 *               body: { type: string }
 *               active: { type: boolean }
 *     responses:
 *       200: { description: Updated, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/Template' } } } } } }
 *       400: { description: Invalid data, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Not its creator nor an ADMIN, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Does not exist, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       409: { description: Duplicate name, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
export const templatesDocs = 'templates';
