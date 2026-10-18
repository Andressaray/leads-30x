/**
 * @swagger
 * tags:
 *   - name: Catálogo
 *     description: Categorías, municipios y fuentes disponibles
 *
 * /catalogo/categorias:
 *   get:
 *     tags: [Catálogo]
 *     summary: Categorías de negocio y su equivalente en cada fuente
 *     responses:
 *       200:
 *         description: Categorías
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
 *                       clave: { type: string, example: hotel }
 *                       nombre: { type: string, example: Hoteles y alojamiento }
 *                       osm: { type: array, items: { type: string } }
 *                       ciiu: { type: array, items: { type: string } }
 *                       rnt: { type: array, items: { type: string } }
 *                       secop: { type: array, items: { type: string }, description: Prefijos UNSPSC }
 *                       reps: { type: boolean }
 *                       fuentes: { type: array, items: { type: string } }
 *       401: { description: Sin sesión o sesión vencida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /catalogo/departamentos:
 *   get:
 *     tags: [Catálogo]
 *     summary: Departamentos de Colombia (DIVIPOLA), ordenados por nombre
 *     responses:
 *       200:
 *         description: Departamentos
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
 *                       codigo: { type: string, example: '05' }
 *                       nombre: { type: string, example: Antioquia }
 *       401: { description: Sin sesión o sesión vencida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /catalogo/municipios:
 *   get:
 *     tags: [Catálogo]
 *     summary: Busca municipios de la DIVIPOLA
 *     parameters:
 *       - { in: query, name: q, schema: { type: string, example: granada } }
 *       - { in: query, name: departamento, schema: { type: string, example: Meta } }
 *       - { in: query, name: limite, schema: { type: integer, default: 50, maximum: 1200 } }
 *     responses:
 *       200:
 *         description: Municipios
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
 *                       codigo: { type: string, example: '50313' }
 *                       nombre: { type: string, example: GRANADA }
 *                       departamento: { type: string, example: Meta }
 *                       tipo: { type: string }
 *                       lat: { type: number }
 *                       lon: { type: number }
 *       400: { description: Departamento o límite inválido, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión o sesión vencida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /catalogo/fuentes:
 *   get:
 *     tags: [Catálogo]
 *     summary: Fuentes disponibles y qué datos de contacto trae cada una
 *     responses:
 *       200:
 *         description: Fuentes
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
 *                       nombre: { type: string }
 *                       descripcion: { type: string }
 *                       contacto: { type: string }
 *                       enlace: { type: string }
 *       401: { description: Sin sesión o sesión vencida, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
export const catalogoDocs = 'catalogo';
