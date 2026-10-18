/**
 * @swagger
 * tags:
 *   - name: Costos
 *     description: 'Lo que costó cada canal en un periodo (insumo del CPL). Los ve cualquiera con sesión; solo un ADMIN los registra.'
 *
 * components:
 *   schemas:
 *     Costo:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         canal: { type: string, enum: [dane, osm, rnt, secop, reps, email, whatsapp, llamada, dapta, general], description: 'Fuente, canal de contacto o general (se reparte entre las fuentes según sus leads)' }
 *         tipo: { type: string, enum: [GASTO, HORAS] }
 *         descripcion: { type: string, example: 'Brevo plan Starter' }
 *         monto: { type: number, example: 31000, description: 'Pesos. En HORAS = horas × valorHora' }
 *         horas: { type: number, nullable: true }
 *         valorHora: { type: number, nullable: true }
 *         desde: { type: string, format: date, example: '2026-10-01' }
 *         hasta: { type: string, format: date, example: '2026-10-31' }
 *         creadoPor: { type: object, nullable: true, properties: { id: { type: integer }, fullName: { type: string } } }
 *     CostoEntrada:
 *       type: object
 *       properties:
 *         canal: { type: string }
 *         tipo: { type: string, enum: [GASTO, HORAS], default: GASTO }
 *         descripcion: { type: string }
 *         monto: { type: number, description: 'Solo GASTO' }
 *         horas: { type: number, description: 'Solo HORAS' }
 *         valorHora: { type: number, description: 'Solo HORAS' }
 *         desde: { type: string, format: date }
 *         hasta: { type: string, format: date }
 *
 * /costos:
 *   get:
 *     tags: [Costos]
 *     summary: Costos (los que se cruzan con el periodo, si se indica)
 *     parameters:
 *       - { in: query, name: desde, schema: { type: string, format: date } }
 *       - { in: query, name: hasta, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Lista, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { type: array, items: { $ref: '#/components/schemas/Costo' } } } } } } }
 *       400: { description: Fecha inválida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *   post:
 *     tags: [Costos]
 *     summary: Registra un costo (solo ADMIN)
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { allOf: [{ $ref: '#/components/schemas/CostoEntrada' }], required: [canal, descripcion, desde, hasta] } } }
 *     responses:
 *       201: { description: Creado, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/Costo' } } } } } }
 *       400: { description: 'Datos inválidos, periodo al revés o falta el monto (o las horas y su valor)', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: No es ADMIN, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /costos/{id}:
 *   patch:
 *     tags: [Costos]
 *     summary: Edita un costo (solo ADMIN)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content: { application/json: { schema: { $ref: '#/components/schemas/CostoEntrada' } } }
 *     responses:
 *       200: { description: Actualizado, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/Costo' } } } } } }
 *       400: { description: Datos inválidos, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: No es ADMIN, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: No existe, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *   delete:
 *     tags: [Costos]
 *     summary: Borra un costo (solo ADMIN)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: 'Borrado: { id }' }
 *       400: { description: Id inválido, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: No es ADMIN, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: No existe, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
export const costosDocs = 'costos';
