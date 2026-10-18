/**
 * @swagger
 * tags:
 *   - name: Searches
 *     description: Search a city's leads across every source
 *
 * components:
 *   schemas:
 *     CreateSearch:
 *       type: object
 *       properties:
 *         city: { type: string, example: 'Rionegro', description: 'Required when code is not sent' }
 *         department: { type: string, example: 'Antioquia', description: 'Needed when the city name exists in several departments' }
 *         code: { type: string, example: '05615', description: 'DIVIPOLA code, instead of city' }
 *         category: { type: string, example: 'hotel', description: 'See GET /catalog/categories. Without a category it returns every business' }
 *         ciiu: { type: array, items: { type: string, example: '4752' }, description: 'Extra CIIU codes for DANE' }
 *         osm: { type: array, items: { type: string, example: 'shop=hardware' }, description: 'Extra OpenStreetMap tags' }
 *         sources: { type: array, items: { type: string, enum: [dane, osm, rnt, secop, reps] }, description: 'All of them by default' }
 *         includeIndividuals: { type: boolean, default: false, description: 'Their contact details are personal data (Ley 1581 de 2012)' }
 *         leadsLimit: { type: integer, default: 200, maximum: 5000 }
 *         async: { type: boolean, default: false, description: 'true = responds 202 with searchId right away; progress is checked with GET /searches/{id}' }
 *         refresh: { type: boolean, default: false, description: 'true = ignores the results cache and queries the sources again' }
 *     SourceResult:
 *       type: object
 *       properties:
 *         source: { type: string }
 *         status: { type: string, enum: [ok, error, skipped] }
 *         records: { type: integer }
 *         new: { type: integer }
 *         enriched: { type: integer }
 *         unchanged: { type: integer }
 *         skipped: { type: integer }
 *         durationMs: { type: integer, nullable: true }
 *         error: { type: string, nullable: true }
 *         meta: { type: object, nullable: true }
 *     SearchSummary:
 *       type: object
 *       properties:
 *         leads: { type: integer, description: 'Distinct leads brought by the search' }
 *         new: { type: integer, description: 'How many of them did not exist yet' }
 *         contactables: { type: integer }
 *         inMultipleSources: { type: integer }
 *         bySource: { type: object, additionalProperties: { $ref: '#/components/schemas/SourceResult' } }
 *     Search:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         cityText: { type: string, nullable: true }
 *         municipalityCode: { type: string }
 *         municipality: { type: string }
 *         department: { type: string }
 *         category: { type: string, nullable: true }
 *         filters: { type: object }
 *         requestedSources: { type: array, items: { type: string } }
 *         status: { type: string, enum: [in_progress, complete, partial, failed] }
 *         summary: { $ref: '#/components/schemas/SearchSummary' }
 *         finishedAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         sources: { type: array, items: { $ref: '#/components/schemas/SourceResult' } }
 *
 * /searches:
 *   post:
 *     tags: [Searches]
 *     summary: Searches a city's leads, matches them and stores them without duplicates
 *     description: Without "async" it can take up to a couple of minutes (OpenStreetMap is slow). With "async" it responds 202 right away. Searches are served one at a time and each source's results are reused for a few hours (cache).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateSearch' }
 *     responses:
 *       201:
 *         description: Complete or partial search (some source failed)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 201 }
 *                 data:
 *                   type: object
 *                   properties:
 *                     searchId: { type: integer }
 *                     status: { type: string, enum: [complete, partial] }
 *                     municipality: { type: object, properties: { code: { type: string }, name: { type: string }, department: { type: string } } }
 *                     filters: { type: object }
 *                     summary: { $ref: '#/components/schemas/SearchSummary' }
 *                     leadsTotal: { type: integer }
 *                     leads: { type: array, items: { $ref: '#/components/schemas/Lead' } }
 *       202:
 *         description: 'With async: true. The search is in progress; poll GET /searches/{id} until status ≠ in_progress'
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 202 }
 *                 data:
 *                   type: object
 *                   properties:
 *                     searchId: { type: integer }
 *                     status: { type: string, enum: [in_progress] }
 *                     queued: { type: integer, description: 'Searches that were ahead in the queue' }
 *                     municipality: { type: object }
 *                     filters: { type: object }
 *       400: { description: 'Invalid data, unknown category or unavailable source', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session or expired session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Municipality or department not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       409: { description: 'The city exists in several departments; details.candidates lists the options', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       429: { description: Too many searches, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       502: { description: 'No source responded; details include the error of each one', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *   get:
 *     tags: [Searches]
 *     summary: Search history
 *     parameters:
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 500 } }
 *     responses:
 *       200:
 *         description: Searches, most recent first
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Search' } }
 *       400: { description: Invalid limit, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session or expired session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /searches/{id}:
 *   get:
 *     tags: [Searches]
 *     summary: Detail of a search with the result of each source
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Search
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 data: { $ref: '#/components/schemas/Search' }
 *       400: { description: Invalid id, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session or expired session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Search not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
export const searchesDocs = 'searches';
