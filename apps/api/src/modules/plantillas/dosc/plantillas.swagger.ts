/**
 * @swagger
 * tags:
 *   - name: Plantillas
 *     description: Mensajes reutilizables para contactar leads (correo, WhatsApp y guion de llamada)
 *
 * components:
 *   schemas:
 *     Plantilla:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 1 }
 *         nombre: { type: string, example: 'Primer contacto por correo' }
 *         canal: { type: string, enum: [EMAIL, WHATSAPP, LLAMADA] }
 *         asunto: { type: string, nullable: true, example: 'Una propuesta para {{nombre}}' }
 *         cuerpo: { type: string, example: 'Hola, equipo de {{nombre}}. Vimos su negocio en {{municipio}}…' }
 *         activa: { type: boolean }
 *         creadoPorId: { type: integer, nullable: true }
 *         creadoPor: { type: object, nullable: true, properties: { id: { type: integer }, fullName: { type: string } } }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *
 * /plantillas:
 *   get:
 *     tags: [Plantillas]
 *     summary: Plantillas activas (o todas con inactivas=true)
 *     parameters:
 *       - { in: query, name: canal, schema: { type: string, enum: [EMAIL, WHATSAPP, LLAMADA] } }
 *       - { in: query, name: inactivas, schema: { type: boolean } }
 *     responses:
 *       200:
 *         description: Lista de plantillas
 *         content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { type: array, items: { $ref: '#/components/schemas/Plantilla' } } } } } }
 *       400: { description: Filtro inválido, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión o sesión vencida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *   post:
 *     tags: [Plantillas]
 *     summary: Crea una plantilla
 *     description: 'Variables disponibles: {{nombre}}, {{municipio}}, {{departamento}}, {{categoria}}, {{remitente}}, {{empresa}}. Las de correo necesitan asunto.'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, canal, cuerpo]
 *             properties:
 *               nombre: { type: string }
 *               canal: { type: string, enum: [EMAIL, WHATSAPP, LLAMADA] }
 *               asunto: { type: string }
 *               cuerpo: { type: string }
 *     responses:
 *       201: { description: Creada, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/Plantilla' } } } } } }
 *       400: { description: Datos inválidos, variable desconocida o correo sin asunto, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       409: { description: Ya existe una plantilla con ese nombre, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /plantillas/variables:
 *   get:
 *     tags: [Plantillas]
 *     summary: Variables que se pueden usar en las plantillas
 *     responses:
 *       200: { description: 'Lista de { nombre, descripcion }' }
 *       401: { description: Sin sesión, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /plantillas/{id}:
 *   get:
 *     tags: [Plantillas]
 *     summary: Una plantilla
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: La plantilla, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/Plantilla' } } } } } }
 *       400: { description: Id inválido, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: No existe, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *   patch:
 *     tags: [Plantillas]
 *     summary: Edita o desactiva una plantilla (quien la creó o un ADMIN)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre: { type: string }
 *               asunto: { type: string }
 *               cuerpo: { type: string }
 *               activa: { type: boolean }
 *     responses:
 *       200: { description: Actualizada, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/Plantilla' } } } } } }
 *       400: { description: Datos inválidos, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: No es quien la creó ni ADMIN, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: No existe, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       409: { description: Nombre repetido, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
export const plantillasDocs = 'plantillas';
