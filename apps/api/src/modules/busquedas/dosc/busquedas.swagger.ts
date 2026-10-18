/**
 * @swagger
 * tags:
 *   - name: Búsquedas
 *     description: Buscar leads de una ciudad en todas las fuentes
 *
 * components:
 *   schemas:
 *     CrearBusqueda:
 *       type: object
 *       properties:
 *         ciudad: { type: string, example: 'Rionegro', description: 'Obligatorio si no se envía codigo' }
 *         departamento: { type: string, example: 'Antioquia', description: 'Necesario si el nombre de la ciudad se repite' }
 *         codigo: { type: string, example: '05615', description: 'Código DIVIPOLA, en lugar de ciudad' }
 *         categoria: { type: string, example: 'hoteles', description: 'Ver GET /catalogo/categorias. Sin categoría trae todos los negocios' }
 *         ciiu: { type: array, items: { type: string, example: '4752' }, description: 'Códigos CIIU extra para el DANE' }
 *         osm: { type: array, items: { type: string, example: 'shop=hardware' }, description: 'Etiquetas extra para OpenStreetMap' }
 *         fuentes: { type: array, items: { type: string, enum: [dane, osm, rnt, secop, reps] }, description: 'Por defecto todas' }
 *         incluirPersonasNaturales: { type: boolean, default: false, description: 'Sus datos de contacto son datos personales (Ley 1581 de 2012)' }
 *         limiteLeads: { type: integer, default: 200, maximum: 5000 }
 *         asincrona: { type: boolean, default: false, description: 'true = responde 202 con busquedaId de inmediato; el avance se consulta en GET /busquedas/{id}' }
 *         refrescar: { type: boolean, default: false, description: 'true = ignora la caché de resultados y vuelve a consultar las fuentes' }
 *     ResultadoFuente:
 *       type: object
 *       properties:
 *         fuente: { type: string }
 *         estado: { type: string, enum: [ok, error, omitida] }
 *         registros: { type: integer }
 *         nuevos: { type: integer }
 *         enriquecidos: { type: integer }
 *         sinCambios: { type: integer }
 *         omitidos: { type: integer }
 *         duracionMs: { type: integer, nullable: true }
 *         error: { type: string, nullable: true }
 *         meta: { type: object, nullable: true }
 *     ResumenBusqueda:
 *       type: object
 *       properties:
 *         leads: { type: integer, description: 'Leads distintos que trajo la búsqueda' }
 *         nuevos: { type: integer, description: 'De esos, cuántos no existían' }
 *         contactables: { type: integer }
 *         enVariasFuentes: { type: integer }
 *         porFuente: { type: object, additionalProperties: { $ref: '#/components/schemas/ResultadoFuente' } }
 *     Busqueda:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         ciudadTexto: { type: string, nullable: true }
 *         codMpio: { type: string }
 *         municipio: { type: string }
 *         departamento: { type: string }
 *         categoria: { type: string, nullable: true }
 *         filtros: { type: object }
 *         fuentesPedidas: { type: array, items: { type: string } }
 *         estado: { type: string, enum: [en_curso, completa, parcial, fallida] }
 *         resumen: { $ref: '#/components/schemas/ResumenBusqueda' }
 *         terminadoEn: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         fuentes: { type: array, items: { $ref: '#/components/schemas/ResultadoFuente' } }
 *
 * /busquedas:
 *   post:
 *     tags: [Búsquedas]
 *     summary: Busca leads de una ciudad, los cruza y los guarda sin duplicados
 *     description: Sin "asincrona" puede tardar hasta un par de minutos (OpenStreetMap es lento). Con "asincrona" responde 202 al instante. Las búsquedas se atienden una a la vez y los resultados de cada fuente se reutilizan unas horas (caché).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CrearBusqueda' }
 *     responses:
 *       201:
 *         description: Búsqueda completa o parcial (alguna fuente falló)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 201 }
 *                 data:
 *                   type: object
 *                   properties:
 *                     busquedaId: { type: integer }
 *                     estado: { type: string, enum: [completa, parcial] }
 *                     municipio: { type: object, properties: { codigo: { type: string }, nombre: { type: string }, departamento: { type: string } } }
 *                     filtros: { type: object }
 *                     resumen: { $ref: '#/components/schemas/ResumenBusqueda' }
 *                     leadsTotal: { type: integer }
 *                     leads: { type: array, items: { $ref: '#/components/schemas/Lead' } }
 *       202:
 *         description: 'Con asincrona: true. La búsqueda quedó en curso; consulta GET /busquedas/{id} hasta que estado ≠ en_curso'
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 202 }
 *                 data:
 *                   type: object
 *                   properties:
 *                     busquedaId: { type: integer }
 *                     estado: { type: string, enum: [en_curso] }
 *                     enCola: { type: integer, description: 'Búsquedas que había delante' }
 *                     municipio: { type: object }
 *                     filtros: { type: object }
 *       400: { description: 'Datos inválidos, categoría desconocida o fuente no disponible', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión o sesión vencida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Municipio o departamento no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       409: { description: 'La ciudad existe en varios departamentos; details.candidatos trae las opciones', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       429: { description: Demasiadas búsquedas, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       502: { description: 'Ninguna fuente respondió; details trae el error de cada una', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *   get:
 *     tags: [Búsquedas]
 *     summary: Historial de búsquedas
 *     parameters:
 *       - { in: query, name: limite, schema: { type: integer, default: 50, maximum: 500 } }
 *     responses:
 *       200:
 *         description: Búsquedas, la más reciente primero
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Busqueda' } }
 *       400: { description: Límite inválido, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión o sesión vencida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /busquedas/{id}:
 *   get:
 *     tags: [Búsquedas]
 *     summary: Detalle de una búsqueda con el resultado de cada fuente
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Búsqueda
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 data: { $ref: '#/components/schemas/Busqueda' }
 *       400: { description: Id inválido, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión o sesión vencida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Búsqueda no encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
export const busquedasDocs = 'busquedas';
