/**
 * @swagger
 * tags:
 *   - name: Contacto
 *     description: |
 *       Contactar leads desde la plataforma y registrar quién respondió.
 *       El correo sale por SMTP; WhatsApp y llamadas se hacen fuera y se registran.
 *       Mientras el lead no haya respondido se aplica la Ley 2300 de 2023: lunes a viernes 7 a. m.–7 p. m.,
 *       sábados 8 a. m.–3 p. m., sin domingos ni festivos; un contacto por día y un solo canal por semana
 *       (se desactiva con CONTACTO_HORARIO_LEGAL=false).
 *
 * components:
 *   schemas:
 *     EstadoContacto:
 *       type: string
 *       enum: [PENDIENTE, CONTACTADO, RESPONDIO, INTERESADO, NO_INTERESADO, REBOTADO]
 *     Interaccion:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         leadId: { type: integer }
 *         usuarioId: { type: integer, nullable: true }
 *         usuario: { type: object, nullable: true, properties: { id: { type: integer }, fullName: { type: string } } }
 *         canal: { type: string, enum: [EMAIL, WHATSAPP, LLAMADA, OTRO] }
 *         sentido: { type: string, enum: [SALIENTE, ENTRANTE] }
 *         estado: { type: string, enum: [ENVIADO, SIMULADO, FALLIDO, REGISTRADO], description: 'SIMULADO = sin SMTP en desarrollo: no salió' }
 *         destino: { type: string, nullable: true, example: 'contacto@negocio.co' }
 *         asunto: { type: string, nullable: true }
 *         mensaje: { type: string, nullable: true }
 *         nota: { type: string, nullable: true }
 *         resultado: { allOf: [{ $ref: '#/components/schemas/EstadoContacto' }], nullable: true, description: 'Solo en las entrantes' }
 *         error: { type: string, nullable: true }
 *         plantillaId: { type: integer, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *     LeadContacto:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         nombre: { type: string }
 *         municipio: { type: string }
 *         emails: { type: array, items: { type: string } }
 *         telefonos: { type: array, items: { $ref: '#/components/schemas/Telefono' } }
 *         contactadoPor: { type: object, nullable: true }
 *         estadoContacto: { $ref: '#/components/schemas/EstadoContacto' }
 *         ultimoContactoEn: { type: string, format: date-time, nullable: true }
 *         respondioEn: { type: string, format: date-time, nullable: true }
 *         noContactar: { type: boolean }
 *     ResultadoContacto:
 *       type: object
 *       properties:
 *         interaccion: { $ref: '#/components/schemas/Interaccion' }
 *         lead: { $ref: '#/components/schemas/LeadContacto' }
 *   responses:
 *     ErrorContacto:
 *       description: Error
 *       content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *
 * /leads/{id}/contacto:
 *   get:
 *     tags: [Contacto]
 *     summary: Ficha de contacto del lead
 *     description: Estado, historial, correos y números por canal, y si se puede contactar ahora (permiso.motivo / permiso.porCanal explican por qué no).
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Ficha }
 *       400: { $ref: '#/components/responses/ErrorContacto' }
 *       401: { $ref: '#/components/responses/ErrorContacto' }
 *       404: { $ref: '#/components/responses/ErrorContacto' }
 *
 * /leads/{id}/contacto/vista-previa:
 *   post:
 *     tags: [Contacto]
 *     summary: Rellena una plantilla (o un texto) con los datos del lead
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plantillaId: { type: integer }
 *               asunto: { type: string }
 *               cuerpo: { type: string }
 *     responses:
 *       200:
 *         description: 'Mensaje listo: { asunto, mensaje, pie }. El pie (firma y cómo darse de baja) se agrega solo al enviar el correo.'
 *       400: { $ref: '#/components/responses/ErrorContacto' }
 *       401: { $ref: '#/components/responses/ErrorContacto' }
 *       404: { $ref: '#/components/responses/ErrorContacto' }
 *
 * /leads/{id}/correo:
 *   post:
 *     tags: [Contacto]
 *     summary: Envía un correo al lead
 *     description: Si nadie lo tenía, el lead queda asignado a quien envía y pasa a CONTACTADO.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [asunto, mensaje]
 *             properties:
 *               para: { type: string, description: 'Uno de los correos del lead (por defecto el primero)' }
 *               asunto: { type: string }
 *               mensaje: { type: string, description: 'Texto final (sin variables {{...}})' }
 *               plantillaId: { type: integer }
 *     responses:
 *       201: { description: Enviado, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/ResultadoContacto' } } } } } }
 *       400: { $ref: '#/components/responses/ErrorContacto' }
 *       401: { $ref: '#/components/responses/ErrorContacto' }
 *       404: { $ref: '#/components/responses/ErrorContacto' }
 *       409: { description: 'Pidió no ser contactado, dijo que no le interesa o lo trabaja otra persona', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       422: { description: 'Ley 2300 (horario, un contacto por día, un canal por semana) o el lead no tiene correo', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       502: { description: El servidor de correo lo rechazó (queda registrado como FALLIDO), content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /leads/{id}/interacciones:
 *   post:
 *     tags: [Contacto]
 *     summary: Registra un WhatsApp, una llamada u otro contacto hecho fuera de la plataforma
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [canal]
 *             properties:
 *               canal: { type: string, enum: [WHATSAPP, LLAMADA, OTRO] }
 *               destino: { type: string, description: 'Uno de los números del lead (por defecto el primero del canal)' }
 *               mensaje: { type: string }
 *               nota: { type: string }
 *               plantillaId: { type: integer }
 *     responses:
 *       201: { description: Registrado, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/ResultadoContacto' } } } } } }
 *       400: { $ref: '#/components/responses/ErrorContacto' }
 *       401: { $ref: '#/components/responses/ErrorContacto' }
 *       404: { $ref: '#/components/responses/ErrorContacto' }
 *       409: { $ref: '#/components/responses/ErrorContacto' }
 *       422: { $ref: '#/components/responses/ErrorContacto' }
 *
 * /leads/{id}/respuesta:
 *   post:
 *     tags: [Contacto]
 *     summary: Registra cómo respondió el lead
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [canal, resultado]
 *             properties:
 *               canal: { type: string, enum: [EMAIL, WHATSAPP, LLAMADA, OTRO] }
 *               resultado: { type: string, enum: [RESPONDIO, INTERESADO, NO_INTERESADO, REBOTADO] }
 *               nota: { type: string }
 *     responses:
 *       201: { description: Registrada, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/ResultadoContacto' } } } } } }
 *       400: { $ref: '#/components/responses/ErrorContacto' }
 *       401: { $ref: '#/components/responses/ErrorContacto' }
 *       404: { $ref: '#/components/responses/ErrorContacto' }
 *       409: { description: 'Todavía no se había contactado, o lo trabaja otra persona', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /leads/{id}/no-contactar:
 *   post:
 *     tags: [Contacto]
 *     summary: El lead pidió no volver a ser contactado
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, properties: { nota: { type: string } } } } }
 *     responses:
 *       200: { description: Marcado, content: { application/json: { schema: { type: object, properties: { status: { type: integer }, data: { $ref: '#/components/schemas/LeadContacto' } } } } } }
 *       400: { $ref: '#/components/responses/ErrorContacto' }
 *       401: { $ref: '#/components/responses/ErrorContacto' }
 *       404: { $ref: '#/components/responses/ErrorContacto' }
 *
 * /bajas/{token}:
 *   get:
 *     tags: [Contacto]
 *     summary: Página pública de baja (enlace del pie de los correos)
 *     security: []
 *     parameters: [{ in: path, name: token, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Página HTML con el botón para confirmar, content: { text/html: {} } }
 *   post:
 *     tags: [Contacto]
 *     summary: Confirma la baja (también la usa el "Cancelar suscripción" de Gmail/Outlook)
 *     security: []
 *     parameters: [{ in: path, name: token, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Página HTML de confirmación, content: { text/html: {} } }
 *       404: { description: Enlace inválido (página HTML), content: { text/html: {} } }
 */
export const contactosDocs = 'contactos';
