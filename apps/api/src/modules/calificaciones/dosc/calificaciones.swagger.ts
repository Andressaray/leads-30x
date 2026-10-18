/**
 * @swagger
 * tags:
 *   - name: Calificación (Dapta)
 *     description: |
 *       La plataforma manda cada lead a un flujo de Dapta (Flow Studio, POST a su "Public Route", que ya trae la
 *       autenticación en la URL: DAPTA_FLOW_URL). El flujo lo califica — normalmente llamándolo con un agente de voz — y
 *       devuelve el resultado a POST /dapta/webhook con la misma "referencia".
 *
 *       Cuerpo que recibe el flujo: referencia, lead_id, contact_name, contact_phone (+57…), contact_email, municipio,
 *       departamento, categoria, fuente, estado_contacto y callback_url.
 *
 *       Si el flujo llama al lead (DAPTA_CONTACTA=true) el envío cuenta como una llamada: aplican las reglas de contacto
 *       (no contactar, responsable, Ley 2300) y queda en el historial con el canal DAPTA.
 *
 * components:
 *   schemas:
 *     Calificacion:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         leadId: { type: integer }
 *         usuario: { type: object, nullable: true, properties: { id: { type: integer }, fullName: { type: string } } }
 *         origen: { type: string, enum: [DAPTA, MANUAL] }
 *         estado: { type: string, enum: [ENVIADO, SIMULADO, FALLIDO, CALIFICADO, SIN_CONTACTO] }
 *         referencia: { type: string, description: 'Viaja a Dapta y vuelve en el webhook' }
 *         calidad: { type: string, nullable: true, enum: [ALTA, MEDIA, BAJA, DESCARTADO] }
 *         puntaje: { type: integer, nullable: true, minimum: 0, maximum: 100 }
 *         resumen: { type: string, nullable: true }
 *         variables: { type: object, nullable: true, description: 'Lo que extrajo el flujo de la llamada' }
 *         llamadaId: { type: string, nullable: true }
 *         error: { type: string, nullable: true }
 *         calificadoEn: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *     ResultadoDapta:
 *       type: object
 *       description: 'Lo que el flujo de Dapta manda al webhook. Se aceptan los nombres en español o en inglés.'
 *       properties:
 *         referencia: { type: string, description: 'O reference. Si no viene, lead_id (toma el último envío pendiente)' }
 *         lead_id: { type: integer }
 *         calificacion: { type: string, example: alta, description: 'alta|media|baja|descartado (o high/medium/low, hot/warm/cold). También calidad, qualification' }
 *         puntaje: { type: integer, example: 82, description: '0–100 (o score). Si no viene calificacion: ≥70 alta, ≥40 media, si no baja' }
 *         resumen: { type: string, description: 'O call_summary, summary' }
 *         variables: { type: object, description: 'Variables extraídas de la llamada (ej. demo_booked)' }
 *         call_id: { type: string }
 *         estado_llamada: { type: string, description: 'O call_status. no_answer, voicemail, busy, failed… sin calificación = SIN_CONTACTO' }
 *
 * /leads/{id}/dapta:
 *   post:
 *     tags: [Calificación (Dapta)]
 *     summary: Manda un lead a Dapta para calificarlo
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       201: { description: 'Enviado (estado ENVIADO, o SIMULADO en desarrollo sin DAPTA_FLOW_URL)', content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/Calificacion' } } } } } }
 *       400: { description: Id inválido, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: El lead no existe, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       409: { description: 'Pidió no ser contactado, lo trabaja otra persona o ya está en Dapta esperando resultado (72 h)', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       422: { description: 'No tiene teléfono para que Dapta llame, o la Ley 2300 no permite llamarlo ahora', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       502: { description: 'Dapta no recibió el lead (queda FALLIDO)', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       503: { description: 'La integración no está configurada (producción sin DAPTA_FLOW_URL)', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /leads/{id}/calificaciones:
 *   get:
 *     tags: [Calificación (Dapta)]
 *     summary: Envíos a Dapta y calificaciones de un lead (la más reciente primero)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Lista, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { type: array, items: { $ref: '#/components/schemas/Calificacion' } } } } } } }
 *       401: { description: Sin sesión, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: El lead no existe, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /leads/{id}/calificacion:
 *   post:
 *     tags: [Calificación (Dapta)]
 *     summary: Califica un lead a mano (quien lo trabaja o un ADMIN)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [calidad]
 *             properties:
 *               calidad: { type: string, enum: [ALTA, MEDIA, BAJA, DESCARTADO] }
 *               puntaje: { type: integer, minimum: 0, maximum: 100 }
 *               nota: { type: string }
 *     responses:
 *       201: { description: Calificado, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/Calificacion' } } } } } }
 *       400: { description: Datos inválidos, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: El lead no existe, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       409: { description: Lo trabaja otra persona, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /dapta/estado:
 *   get:
 *     tags: [Calificación (Dapta)]
 *     summary: 'Cómo está configurada la integración: modo (activo, simulado, desactivado), si Dapta llama y la URL del webhook'
 *     responses:
 *       200: { description: Estado }
 *       401: { description: Sin sesión, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /dapta/envios:
 *   post:
 *     tags: [Calificación (Dapta)]
 *     summary: Manda varios leads a Dapta (máximo 100). Los que no se pueden se omiten con su motivo
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [leadIds], properties: { leadIds: { type: array, items: { type: integer } } } } } }
 *     responses:
 *       200: { description: 'Resumen: { enviados, omitidos, resultados: [{ leadId, ok, motivo }] }' }
 *       400: { description: Lista inválida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       503: { description: La integración no está configurada, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /dapta/webhook:
 *   post:
 *     tags: [Calificación (Dapta)]
 *     summary: Resultado de la calificación (lo llama el flujo de Dapta)
 *     description: 'Sin sesión. El secreto (DAPTA_WEBHOOK_SECRET) va en la cabecera x-dapta-secret, en Authorization: Bearer, o en la URL (?token=…) si el nodo HTTP del flujo no permite cabeceras.'
 *     security: []
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/ResultadoDapta' } } }
 *     responses:
 *       200: { description: 'Guardado: { id, leadId, estado, calidad, puntaje }' }
 *       400: { description: 'Sin referencia, calificación desconocida, puntaje fuera de rango o sin calificación', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Secreto inválido, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: No hay un envío con esa referencia, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       503: { description: Falta DAPTA_WEBHOOK_SECRET en el servidor, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
export const calificacionesDocs = 'calificaciones';
