/**
 * @swagger
 * tags:
 *   - name: Outreach
 *     description: |
 *       Contact leads from the platform and record who replied.
 *       Emails go out through SMTP; WhatsApp messages and calls happen outside and are recorded.
 *       While the lead has not replied, Ley 2300 de 2023 applies: Monday to Friday 7 a.m.–7 p.m.,
 *       Saturdays 8 a.m.–3 p.m., no Sundays or holidays; one contact per day and a single channel per week
 *       (it is turned off with CONTACT_LEGAL_HOURS=false).
 *
 * components:
 *   schemas:
 *     ContactStatus:
 *       type: string
 *       enum: [PENDING, CONTACTED, REPLIED, INTERESTED, NOT_INTERESTED, BOUNCED]
 *     Interaction:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         leadId: { type: integer }
 *         userId: { type: integer, nullable: true }
 *         user: { type: object, nullable: true, properties: { id: { type: integer }, fullName: { type: string } } }
 *         channel: { type: string, enum: [EMAIL, WHATSAPP, CALL, OTHER, DAPTA] }
 *         direction: { type: string, enum: [OUTBOUND, INBOUND] }
 *         status: { type: string, enum: [SENT, SIMULATED, FAILED, RECORDED], description: 'SIMULATED = no SMTP in development: it was not sent' }
 *         destination: { type: string, nullable: true, example: 'contacto@negocio.co' }
 *         subject: { type: string, nullable: true }
 *         message: { type: string, nullable: true }
 *         note: { type: string, nullable: true }
 *         result: { allOf: [{ $ref: '#/components/schemas/ContactStatus' }], nullable: true, description: 'Only on inbound interactions' }
 *         error: { type: string, nullable: true }
 *         templateId: { type: integer, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *     LeadContact:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         name: { type: string }
 *         municipality: { type: string }
 *         emails: { type: array, items: { type: string } }
 *         phones: { type: array, items: { $ref: '#/components/schemas/Phone' } }
 *         contactedBy: { type: object, nullable: true }
 *         contactStatus: { $ref: '#/components/schemas/ContactStatus' }
 *         lastContactedAt: { type: string, format: date-time, nullable: true }
 *         repliedAt: { type: string, format: date-time, nullable: true }
 *         doNotContact: { type: boolean }
 *     ContactResult:
 *       type: object
 *       properties:
 *         interaction: { $ref: '#/components/schemas/Interaction' }
 *         lead: { $ref: '#/components/schemas/LeadContact' }
 *   responses:
 *     OutreachError:
 *       description: Error
 *       content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *
 * /leads/{id}/contact:
 *   get:
 *     tags: [Outreach]
 *     summary: Contact sheet of the lead
 *     description: Status, history, emails and numbers per channel, and whether the lead can be contacted now (permission.reason / permission.byChannel explain why not).
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Contact sheet }
 *       400: { $ref: '#/components/responses/OutreachError' }
 *       401: { $ref: '#/components/responses/OutreachError' }
 *       404: { $ref: '#/components/responses/OutreachError' }
 *
 * /leads/{id}/contact/preview:
 *   post:
 *     tags: [Outreach]
 *     summary: Fills a template (or a text) with the lead's data
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               templateId: { type: integer }
 *               subject: { type: string }
 *               body: { type: string }
 *     responses:
 *       200:
 *         description: 'Ready message: { subject, message, footer }. The footer (signature and how to unsubscribe) is added only when the email is sent.'
 *       400: { $ref: '#/components/responses/OutreachError' }
 *       401: { $ref: '#/components/responses/OutreachError' }
 *       404: { $ref: '#/components/responses/OutreachError' }
 *
 * /leads/{id}/email:
 *   post:
 *     tags: [Outreach]
 *     summary: Sends an email to the lead
 *     description: If nobody had it, the lead is assigned to the sender and moves to CONTACTED.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, message]
 *             properties:
 *               to: { type: string, description: 'One of the lead emails (the first one by default)' }
 *               subject: { type: string }
 *               message: { type: string, description: 'Final text (without {{...}} variables)' }
 *               templateId: { type: integer }
 *     responses:
 *       201: { description: Sent, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/ContactResult' } } } } } }
 *       400: { $ref: '#/components/responses/OutreachError' }
 *       401: { $ref: '#/components/responses/OutreachError' }
 *       404: { $ref: '#/components/responses/OutreachError' }
 *       409: { description: 'Asked not to be contacted, said they are not interested, or someone else works the lead', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       422: { description: 'Ley 2300 (hours, one contact per day, one channel per week) or the lead has no email', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       502: { description: The mail server rejected it (recorded as FAILED), content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /leads/{id}/interactions:
 *   post:
 *     tags: [Outreach]
 *     summary: Records a WhatsApp message, a call or another contact made outside the platform
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [channel]
 *             properties:
 *               channel: { type: string, enum: [WHATSAPP, CALL, OTHER] }
 *               destination: { type: string, description: 'One of the lead numbers (the first one of the channel by default)' }
 *               message: { type: string }
 *               note: { type: string }
 *               templateId: { type: integer }
 *     responses:
 *       201: { description: Recorded, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/ContactResult' } } } } } }
 *       400: { $ref: '#/components/responses/OutreachError' }
 *       401: { $ref: '#/components/responses/OutreachError' }
 *       404: { $ref: '#/components/responses/OutreachError' }
 *       409: { $ref: '#/components/responses/OutreachError' }
 *       422: { $ref: '#/components/responses/OutreachError' }
 *
 * /leads/{id}/reply:
 *   post:
 *     tags: [Outreach]
 *     summary: Records how the lead replied
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [channel, result]
 *             properties:
 *               channel: { type: string, enum: [EMAIL, WHATSAPP, CALL, OTHER, DAPTA] }
 *               result: { type: string, enum: [REPLIED, INTERESTED, NOT_INTERESTED, BOUNCED] }
 *               note: { type: string }
 *     responses:
 *       201: { description: Recorded, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/ContactResult' } } } } } }
 *       400: { $ref: '#/components/responses/OutreachError' }
 *       401: { $ref: '#/components/responses/OutreachError' }
 *       404: { $ref: '#/components/responses/OutreachError' }
 *       409: { description: 'The lead had not been contacted yet, or someone else works it', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /leads/{id}/do-not-contact:
 *   post:
 *     tags: [Outreach]
 *     summary: The lead asked not to be contacted again
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, properties: { note: { type: string } } } } }
 *     responses:
 *       200: { description: Marked, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/LeadContact' } } } } } }
 *       400: { $ref: '#/components/responses/OutreachError' }
 *       401: { $ref: '#/components/responses/OutreachError' }
 *       404: { $ref: '#/components/responses/OutreachError' }
 *
 * /unsubscribe/{token}:
 *   get:
 *     tags: [Outreach]
 *     summary: Public unsubscribe page (link in the email footer)
 *     security: []
 *     parameters: [{ in: path, name: token, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: HTML page with the confirmation button, content: { text/html: {} } }
 *   post:
 *     tags: [Outreach]
 *     summary: Confirms the unsubscribe (also used by the "Unsubscribe" button in Gmail/Outlook)
 *     security: []
 *     parameters: [{ in: path, name: token, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: HTML confirmation page, content: { text/html: {} } }
 *       404: { description: Invalid link (HTML page), content: { text/html: {} } }
 */
export const outreachDocs = 'outreach';
