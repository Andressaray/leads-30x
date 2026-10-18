/**
 * @swagger
 * tags:
 *   - name: Costs
 *     description: 'What each channel cost in a period (input for the CPL). Anyone with a session can see them; only an ADMIN records them.'
 *
 * components:
 *   schemas:
 *     Cost:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         channel: { type: string, enum: [dane, osm, rnt, secop, reps, email, whatsapp, call, dapta, general], description: 'Source, contact channel or general (split among sources according to their leads)' }
 *         type: { type: string, enum: [EXPENSE, HOURS] }
 *         description: { type: string, example: 'Brevo plan Starter' }
 *         amount: { type: number, example: 31000, description: 'Colombian pesos. For HOURS = hours × hourlyRate' }
 *         hours: { type: number, nullable: true }
 *         hourlyRate: { type: number, nullable: true }
 *         from: { type: string, format: date, example: '2026-10-01' }
 *         to: { type: string, format: date, example: '2026-10-31' }
 *         createdBy: { type: object, nullable: true, properties: { id: { type: integer }, fullName: { type: string } } }
 *     CostInput:
 *       type: object
 *       properties:
 *         channel: { type: string }
 *         type: { type: string, enum: [EXPENSE, HOURS], default: EXPENSE }
 *         description: { type: string }
 *         amount: { type: number, description: 'EXPENSE only' }
 *         hours: { type: number, description: 'HOURS only' }
 *         hourlyRate: { type: number, description: 'HOURS only' }
 *         from: { type: string, format: date }
 *         to: { type: string, format: date }
 *
 * /costs:
 *   get:
 *     tags: [Costs]
 *     summary: Costs (those that overlap the period, if one is given)
 *     parameters:
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: List, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { type: array, items: { $ref: '#/components/schemas/Cost' } } } } } } }
 *       400: { description: Invalid date, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *   post:
 *     tags: [Costs]
 *     summary: Records a cost (ADMIN only)
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { allOf: [{ $ref: '#/components/schemas/CostInput' }], required: [channel, description, from, to] } } }
 *     responses:
 *       201: { description: Created, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/Cost' } } } } } }
 *       400: { description: 'Invalid data, reversed period, or the amount (or the hours and hourly rate) is missing', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Not an ADMIN, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /costs/{id}:
 *   patch:
 *     tags: [Costs]
 *     summary: Edits a cost (ADMIN only)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content: { application/json: { schema: { $ref: '#/components/schemas/CostInput' } } }
 *     responses:
 *       200: { description: Updated, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/Cost' } } } } } }
 *       400: { description: Invalid data, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Not an ADMIN, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Does not exist, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *   delete:
 *     tags: [Costs]
 *     summary: Deletes a cost (ADMIN only)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: 'Deleted: { id }' }
 *       400: { description: Invalid id, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       403: { description: Not an ADMIN, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Does not exist, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
export const costsDocs = 'costs';
