/**
 * @swagger
 * tags:
 *   - name: Catalog
 *     description: Available categories, municipalities and sources
 *
 * /catalog/categories:
 *   get:
 *     tags: [Catalog]
 *     summary: Business categories and their equivalent in each source
 *     responses:
 *       200:
 *         description: Categories
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
 *                       key: { type: string, example: hotel }
 *                       name: { type: string, example: Hoteles y alojamiento }
 *                       osm: { type: array, items: { type: string } }
 *                       ciiu: { type: array, items: { type: string } }
 *                       rnt: { type: array, items: { type: string } }
 *                       secop: { type: array, items: { type: string }, description: UNSPSC prefixes }
 *                       reps: { type: boolean }
 *                       sources: { type: array, items: { type: string } }
 *       401: { description: No session or expired session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /catalog/departments:
 *   get:
 *     tags: [Catalog]
 *     summary: Departments of Colombia (DIVIPOLA), sorted by name
 *     responses:
 *       200:
 *         description: Departments
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
 *                       code: { type: string, example: '05' }
 *                       name: { type: string, example: Antioquia }
 *       401: { description: No session or expired session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /catalog/municipalities:
 *   get:
 *     tags: [Catalog]
 *     summary: Searches DIVIPOLA municipalities
 *     parameters:
 *       - { in: query, name: q, schema: { type: string, example: granada } }
 *       - { in: query, name: department, schema: { type: string, example: Meta } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 1200 } }
 *     responses:
 *       200:
 *         description: Municipalities
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
 *                       code: { type: string, example: '50313' }
 *                       name: { type: string, example: GRANADA }
 *                       department: { type: string, example: Meta }
 *                       departmentCode: { type: string, example: '50' }
 *                       type: { type: string }
 *                       lat: { type: number }
 *                       lon: { type: number }
 *       400: { description: Invalid department or limit, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session or expired session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /catalog/sources:
 *   get:
 *     tags: [Catalog]
 *     summary: Available sources and what contact data each one provides
 *     responses:
 *       200:
 *         description: Sources
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
 *                       name: { type: string }
 *                       description: { type: string }
 *                       contact: { type: string }
 *                       link: { type: string }
 *       401: { description: No session or expired session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
export const catalogDocs = 'catalog';
