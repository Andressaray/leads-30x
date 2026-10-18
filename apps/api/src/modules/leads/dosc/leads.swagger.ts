/**
 * @swagger
 * tags:
 *   - name: Leads
 *     description: Negocios guardados, ya deduplicados entre fuentes
 *
 * components:
 *   schemas:
 *     Telefono:
 *       type: object
 *       properties:
 *         numero: { type: string, example: '+573001234567' }
 *         tipo: { type: string, enum: [movil, fijo] }
 *         whatsapp: { type: boolean }
 *     Lead:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 12 }
 *         nombre: { type: string, example: 'Hotel Ejemplo' }
 *         nombreComercial: { type: string, nullable: true }
 *         razonSocial: { type: string, nullable: true, example: 'INVERSIONES EJEMPLO SAS' }
 *         nit: { type: string, nullable: true, example: '900000000' }
 *         codMpio: { type: string, example: '05615' }
 *         municipio: { type: string, example: 'RIONEGRO' }
 *         departamento: { type: string, example: 'Antioquia' }
 *         direccion: { type: string, nullable: true }
 *         lat: { type: number, nullable: true }
 *         lon: { type: number, nullable: true }
 *         ciiu: { type: string, nullable: true }
 *         categoriaFuente: { type: string, nullable: true }
 *         categorias: { type: array, items: { type: string } }
 *         telefonos: { type: array, items: { $ref: '#/components/schemas/Telefono' } }
 *         emails: { type: array, items: { type: string } }
 *         sitiosWeb: { type: array, items: { type: string } }
 *         redes: { type: array, items: { type: string } }
 *         canalPrincipal: { type: string, nullable: true, enum: [whatsapp, movil, fijo, email, web, red_social] }
 *         contactable: { type: boolean }
 *         contactado: { type: boolean, description: 'Si ya se hizo el primer acercamiento' }
 *         contactadoEn: { type: string, format: date-time, nullable: true }
 *         contactadoPorId: { type: integer, nullable: true, description: 'Usuario al que quedó asignado al darle Contactar' }
 *         estadoContacto: { $ref: '#/components/schemas/EstadoContacto' }
 *         ultimoContactoEn: { type: string, format: date-time, nullable: true }
 *         respondioEn: { type: string, format: date-time, nullable: true }
 *         noContactar: { type: boolean, description: 'Pidió no volver a ser contactado' }
 *         calidad: { type: string, nullable: true, enum: [ALTA, MEDIA, BAJA, DESCARTADO], description: 'Última calificación (Dapta o manual)' }
 *         puntaje: { type: integer, nullable: true, description: 'Puntaje 0–100 de la última calificación' }
 *         calificadoEn: { type: string, format: date-time, nullable: true }
 *         contactadoPor:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: integer }
 *             fullName: { type: string, example: Andres Saray }
 *             email: { type: string, example: andres@gmail.com }
 *         esPersonaNatural: { type: boolean, nullable: true }
 *         fuentes: { type: array, items: { type: string, enum: [dane, osm, rnt, secop, reps] } }
 *         numFuentes: { type: integer }
 *         fuenteOrigen: { type: string, description: 'Primera fuente que trajo el lead (atribución para el CPL)' }
 *         busquedaOrigenId: { type: integer, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     LeadDetalle:
 *       allOf:
 *         - $ref: '#/components/schemas/Lead'
 *         - type: object
 *           properties:
 *             apariciones:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   fuente: { type: string }
 *                   idExterno: { type: string }
 *                   coincidencia: { type: string, enum: [nuevo, id_externo, nit, telefono, email, dominio, direccion, nombre_cercania, nombre] }
 *                   datos: { type: object, description: 'Registro original de la fuente' }
 *                   busquedaId: { type: integer, nullable: true }
 *                   primeraVez: { type: string, format: date-time }
 *                   ultimaVez: { type: string, format: date-time }
 *   parameters:
 *     FiltroBusqueda: { in: query, name: busqueda, schema: { type: integer }, description: 'Solo los leads que trajo esa búsqueda' }
 *     FiltroMunicipio: { in: query, name: municipio, schema: { type: string, example: '05615' }, description: 'Código DIVIPOLA' }
 *     FiltroDepartamento: { in: query, name: departamento, schema: { type: string, example: 'Antioquia' } }
 *     FiltroCategoria: { in: query, name: categoria, schema: { type: string, example: 'hotel' } }
 *     FiltroFuente: { in: query, name: fuente, schema: { type: string, enum: [dane, osm, rnt, secop, reps] } }
 *     FiltroContactable: { in: query, name: contactable, schema: { type: boolean } }
 *     FiltroContactado: { in: query, name: contactado, schema: { type: boolean }, description: 'Solo leads ya contactados (true) o pendientes (false)' }
 *     FiltroMios: { in: query, name: mios, schema: { type: boolean }, description: 'true = solo los leads que contactó el usuario de la sesión' }
 *     FiltroCalidad: { in: query, name: calidad, schema: { type: string, example: 'ALTA,MEDIA' }, description: 'Calidad de la última calificación (Dapta o manual), separadas por coma: ALTA, MEDIA, BAJA, DESCARTADO, SIN (sin calificar)' }
 *     FiltroEstado: { in: query, name: estado, schema: { type: string, example: 'RESPONDIO,INTERESADO' }, description: 'Uno o varios estados del embudo separados por coma: PENDIENTE, CONTACTADO, RESPONDIO, INTERESADO, NO_INTERESADO, REBOTADO' }
 *     FiltroContactadoPor: { in: query, name: contactado_por, schema: { type: integer }, description: 'Solo los leads que contactó ese usuario (id)' }
 *     FiltroEnAmbas: { in: query, name: en_ambas, schema: { type: boolean }, description: 'Solo leads presentes en 2 o más fuentes' }
 *     FiltroPersonas: { in: query, name: personas_naturales, schema: { type: boolean }, description: 'false excluye personas naturales; true trae solo personas naturales' }
 *     FiltroQ: { in: query, name: q, schema: { type: string }, description: 'Nombre, razón social o NIT' }
 *
 * /leads:
 *   get:
 *     tags: [Leads]
 *     summary: Lista los leads guardados
 *     parameters:
 *       - $ref: '#/components/parameters/FiltroBusqueda'
 *       - $ref: '#/components/parameters/FiltroMunicipio'
 *       - $ref: '#/components/parameters/FiltroDepartamento'
 *       - $ref: '#/components/parameters/FiltroCategoria'
 *       - $ref: '#/components/parameters/FiltroFuente'
 *       - $ref: '#/components/parameters/FiltroContactable'
 *       - $ref: '#/components/parameters/FiltroContactado'
 *       - $ref: '#/components/parameters/FiltroMios'
 *       - $ref: '#/components/parameters/FiltroEstado'
 *       - $ref: '#/components/parameters/FiltroCalidad'
 *       - $ref: '#/components/parameters/FiltroContactadoPor'
 *       - $ref: '#/components/parameters/FiltroEnAmbas'
 *       - $ref: '#/components/parameters/FiltroPersonas'
 *       - $ref: '#/components/parameters/FiltroQ'
 *       - { in: query, name: limite, schema: { type: integer, default: 100, maximum: 1000 } }
 *       - { in: query, name: pagina, schema: { type: integer, default: 1 } }
 *     responses:
 *       200:
 *         description: Página de leads
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 data:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     pagina: { type: integer }
 *                     limite: { type: integer }
 *                     leads: { type: array, items: { $ref: '#/components/schemas/Lead' } }
 *       400: { description: Filtro inválido, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión o sesión vencida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       429: { description: Demasiadas solicitudes, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /leads/export.csv:
 *   get:
 *     tags: [Leads]
 *     summary: Descarga los leads en CSV (abre en Excel con tildes)
 *     parameters:
 *       - $ref: '#/components/parameters/FiltroBusqueda'
 *       - $ref: '#/components/parameters/FiltroMunicipio'
 *       - $ref: '#/components/parameters/FiltroDepartamento'
 *       - $ref: '#/components/parameters/FiltroCategoria'
 *       - $ref: '#/components/parameters/FiltroFuente'
 *       - $ref: '#/components/parameters/FiltroContactable'
 *       - $ref: '#/components/parameters/FiltroContactado'
 *       - $ref: '#/components/parameters/FiltroMios'
 *       - $ref: '#/components/parameters/FiltroEstado'
 *       - $ref: '#/components/parameters/FiltroCalidad'
 *       - $ref: '#/components/parameters/FiltroContactadoPor'
 *       - $ref: '#/components/parameters/FiltroEnAmbas'
 *       - $ref: '#/components/parameters/FiltroPersonas'
 *       - $ref: '#/components/parameters/FiltroQ'
 *       - { in: query, name: limite, schema: { type: integer, default: 100000, maximum: 100000 } }
 *     responses:
 *       200: { description: Archivo CSV, content: { text/csv: { schema: { type: string } } } }
 *       400: { description: Filtro inválido, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión o sesión vencida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /leads/estadisticas:
 *   get:
 *     tags: [Leads]
 *     summary: Leads, contactables y atribuidos por fuente
 *     responses:
 *       200:
 *         description: Una fila por fuente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       fuente: { type: string }
 *                       leads: { type: integer }
 *                       contactables: { type: integer }
 *                       atribuidos: { type: integer, description: 'Leads cuya primera fuente fue esta' }
 *       401: { description: Sin sesión o sesión vencida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /leads/{id}:
 *   get:
 *     tags: [Leads]
 *     summary: Un lead con el historial de cada fuente que lo trajo
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Lead
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 data: { $ref: '#/components/schemas/LeadDetalle' }
 *       400: { description: Id inválido, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión o sesión vencida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Lead no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /leads/{id}/contactar:
 *   post:
 *     tags: [Leads]
 *     summary: Marca un lead como contactado y lo asigna al usuario de la sesión
 *     description: Si ya lo contactó otra persona responde 409 y no lo reasigna. Si fue el mismo usuario, responde 200 sin cambios.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Lead actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 data: { $ref: '#/components/schemas/Lead' }
 *       400: { description: Id inválido, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión o sesión vencida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Lead no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       409: { description: Ya lo contactó otra persona (details trae contactadoPor y contactadoEn), content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
export const leadsDocs = 'leads';
