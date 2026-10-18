/**
 * @swagger
 * tags:
 *   - name: Qualification (Dapta)
 *     description: |
 *       The platform sends each lead to a Dapta flow (Flow Studio, POST to its "Public Route", which already carries the
 *       authentication in the URL: DAPTA_FLOW_URL). The flow qualifies it — usually by calling it with a voice agent — and
 *       returns the result to POST /dapta/webhook with the same "reference".
 *
 *       Body the flow receives: reference, lead_id, contact_name, contact_phone (+57…), contact_email, municipality,
 *       department, category, source, contact_status and callback_url.
 *
 *       If the flow calls the lead (DAPTA_CALLS=true) the dispatch counts as a call: the contact rules apply
 *       (do not contact, owner, Ley 2300) and it is recorded in the history with the DAPTA channel.
 *
 * components:
 *   schemas:
 *     Qualification:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         leadId: { type: integer }
 *         user: { type: object, nullable: true, properties: { id: { type: integer }, fullName: { type: string } } }
 *         origin: { type: string, enum: [DAPTA, MANUAL] }
 *         status: { type: string, enum: [SENT, SIMULATED, FAILED, QUALIFIED, NO_CONTACT] }
 *         reference: { type: string, description: 'Travels to Dapta and comes back in the webhook' }
 *         quality: { type: string, nullable: true, enum: [HIGH, MEDIUM, LOW, DISCARDED] }
 *         score: { type: integer, nullable: true, minimum: 0, maximum: 100 }
 *         summary: { type: string, nullable: true }
 *         variables: { type: object, nullable: true, description: 'What the flow extracted from the call' }
 *         callId: { type: string, nullable: true }
 *         error: { type: string, nullable: true }
 *         qualifiedAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *     DaptaResult:
 *       type: object
 *       description: 'What the Dapta flow sends to the webhook. English or Spanish field names are accepted.'
 *       properties:
 *         reference: { type: string, description: 'Or referencia. If missing, lead_id (takes the latest pending dispatch)' }
 *         lead_id: { type: integer }
 *         quality: { type: string, example: high, description: 'high|medium|low|discarded (or alta/media/baja/descartado, hot/warm/cold). Also qualification, calidad, calificacion' }
 *         score: { type: integer, example: 82, description: '0–100 (or puntaje). Without a quality: ≥70 high, ≥40 medium, otherwise low' }
 *         summary: { type: string, description: 'Or call_summary, resumen' }
 *         variables: { type: object, description: 'Variables extracted from the call (e.g. demo_booked)' }
 *         call_id: { type: string, description: 'Or llamada_id' }
 *         call_status: { type: string, description: 'Or estado_llamada. no_answer, voicemail, busy, failed… without a quality = NO_CONTACT' }
 *
 * /leads/{id}/dapta:
 *   post:
 *     tags: [Qualification (Dapta)]
 *     summary: Sends a lead to Dapta to qualify it
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       201: { description: 'Sent (status SENT, or SIMULATED in development without DAPTA_FLOW_URL)', content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/Qualification' } } } } } }
 *       400: { description: Invalid id, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: The lead does not exist, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       409: { description: 'Asked not to be contacted, someone else works it, or it is already in Dapta waiting for a result (72 h)', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       422: { description: 'It has no phone for Dapta to call, or Ley 2300 does not allow calling it now', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       502: { description: 'Dapta did not receive the lead (recorded as FAILED)', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       503: { description: 'The integration is not configured (production without DAPTA_FLOW_URL)', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /leads/{id}/qualifications:
 *   get:
 *     tags: [Qualification (Dapta)]
 *     summary: Dispatches to Dapta and qualifications of a lead (most recent first)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: List, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { type: array, items: { $ref: '#/components/schemas/Qualification' } } } } } } }
 *       401: { description: No session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: The lead does not exist, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /leads/{id}/qualification:
 *   post:
 *     tags: [Qualification (Dapta)]
 *     summary: Qualifies a lead manually (whoever works it, or an ADMIN)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quality]
 *             properties:
 *               quality: { type: string, enum: [HIGH, MEDIUM, LOW, DISCARDED] }
 *               score: { type: integer, minimum: 0, maximum: 100 }
 *               note: { type: string }
 *     responses:
 *       201: { description: Qualified, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/Qualification' } } } } } }
 *       400: { description: Invalid data, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: The lead does not exist, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       409: { description: Someone else works it, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /dapta/status:
 *   get:
 *     tags: [Qualification (Dapta)]
 *     summary: 'How the integration is configured: mode (active, simulated, disabled), whether Dapta calls, and the webhook URL'
 *     responses:
 *       200: { description: 'Status: { mode, contacts, webhook, urlWebhook }' }
 *       401: { description: No session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /dapta/dispatches:
 *   post:
 *     tags: [Qualification (Dapta)]
 *     summary: Sends several leads to Dapta (at most 100). The ones that cannot be sent are skipped with their reason
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [leadIds], properties: { leadIds: { type: array, items: { type: integer } } } } } }
 *     responses:
 *       200: { description: 'Summary: { sent, skipped, results: [{ leadId, ok, reason }] }' }
 *       400: { description: Invalid list, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       503: { description: The integration is not configured, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /dapta/webhook:
 *   post:
 *     tags: [Qualification (Dapta)]
 *     summary: Qualification result (called by the Dapta flow)
 *     description: 'No session. The secret (DAPTA_WEBHOOK_SECRET) goes in the x-dapta-secret header, in Authorization: Bearer, or in the URL (?token=…) if the flow HTTP node does not allow headers.'
 *     security: []
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/DaptaResult' } } }
 *     responses:
 *       200: { description: 'Saved: { id, leadId, status, quality, score }' }
 *       400: { description: 'No reference, unknown quality, score out of range, or no qualification', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Invalid secret, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: There is no dispatch with that reference, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       503: { description: DAPTA_WEBHOOK_SECRET is missing on the server, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
export const qualificationsDocs = 'qualifications';
