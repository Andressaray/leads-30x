/**
 * @swagger
 * tags:
 *   - name: Leads
 *     description: Stored businesses, already deduplicated across sources
 *
 * components:
 *   schemas:
 *     Phone:
 *       type: object
 *       properties:
 *         number: { type: string, example: '+573001234567' }
 *         type: { type: string, enum: [mobile, landline] }
 *         whatsapp: { type: boolean }
 *     Lead:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 12 }
 *         name: { type: string, example: 'Hotel Ejemplo' }
 *         tradeName: { type: string, nullable: true }
 *         legalName: { type: string, nullable: true, example: 'INVERSIONES EJEMPLO SAS' }
 *         nit: { type: string, nullable: true, example: '900000000' }
 *         municipalityCode: { type: string, example: '05615' }
 *         municipality: { type: string, example: 'RIONEGRO' }
 *         department: { type: string, example: 'Antioquia' }
 *         address: { type: string, nullable: true }
 *         lat: { type: number, nullable: true }
 *         lon: { type: number, nullable: true }
 *         ciiu: { type: string, nullable: true }
 *         sourceCategory: { type: string, nullable: true }
 *         categories: { type: array, items: { type: string } }
 *         phones: { type: array, items: { $ref: '#/components/schemas/Phone' } }
 *         emails: { type: array, items: { type: string } }
 *         websites: { type: array, items: { type: string } }
 *         socialLinks: { type: array, items: { type: string } }
 *         primaryChannel: { type: string, nullable: true, enum: [whatsapp, mobile, landline, email, web, social] }
 *         contactable: { type: boolean }
 *         contacted: { type: boolean, description: 'Whether the first approach was already made' }
 *         contactedAt: { type: string, format: date-time, nullable: true }
 *         contactedById: { type: integer, nullable: true, description: 'User the lead was assigned to when they pressed Contact' }
 *         contactStatus: { $ref: '#/components/schemas/ContactStatus' }
 *         lastContactedAt: { type: string, format: date-time, nullable: true }
 *         repliedAt: { type: string, format: date-time, nullable: true }
 *         doNotContact: { type: boolean, description: 'Asked not to be contacted again' }
 *         quality: { type: string, nullable: true, enum: [HIGH, MEDIUM, LOW, DISCARDED], description: 'Latest qualification (Dapta or manual)' }
 *         score: { type: integer, nullable: true, description: '0–100 score of the latest qualification' }
 *         qualifiedAt: { type: string, format: date-time, nullable: true }
 *         contactedBy:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: integer }
 *             fullName: { type: string, example: Andres Saray }
 *             email: { type: string, example: andres@gmail.com }
 *         isIndividual: { type: boolean, nullable: true }
 *         sources: { type: array, items: { type: string, enum: [dane, osm, rnt, secop, reps] } }
 *         sourceCount: { type: integer }
 *         originSource: { type: string, description: 'First source that brought the lead (attribution for the CPL)' }
 *         originSearchId: { type: integer, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     LeadDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/Lead'
 *         - type: object
 *           properties:
 *             occurrences:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   source: { type: string }
 *                   externalId: { type: string }
 *                   match: { type: string, enum: [new, external_id, nit, phone, email, domain, address, name_proximity, name] }
 *                   data: { type: object, description: 'Original record from the source' }
 *                   searchId: { type: integer, nullable: true }
 *                   firstSeen: { type: string, format: date-time }
 *                   lastSeen: { type: string, format: date-time }
 *   parameters:
 *     SearchFilter: { in: query, name: search, schema: { type: integer }, description: 'Only the leads brought by that search' }
 *     MunicipalityFilter: { in: query, name: municipality, schema: { type: string, example: '05615' }, description: 'DIVIPOLA code' }
 *     DepartmentFilter: { in: query, name: department, schema: { type: string, example: 'Antioquia' } }
 *     CategoryFilter: { in: query, name: category, schema: { type: string, example: 'hotel' } }
 *     SourceFilter: { in: query, name: source, schema: { type: string, enum: [dane, osm, rnt, secop, reps] } }
 *     ContactableFilter: { in: query, name: contactable, schema: { type: boolean } }
 *     ContactedFilter: { in: query, name: contacted, schema: { type: boolean }, description: 'Only leads already contacted (true) or pending (false)' }
 *     MineFilter: { in: query, name: mine, schema: { type: boolean }, description: 'true = only the leads contacted by the session user' }
 *     QualityFilter: { in: query, name: quality, schema: { type: string, example: 'HIGH,MEDIUM' }, description: 'Quality of the latest qualification (Dapta or manual), comma separated: HIGH, MEDIUM, LOW, DISCARDED, NONE (not qualified)' }
 *     StatusFilter: { in: query, name: status, schema: { type: string, example: 'REPLIED,INTERESTED' }, description: 'One or more funnel statuses, comma separated: PENDING, CONTACTED, REPLIED, INTERESTED, NOT_INTERESTED, BOUNCED' }
 *     ContactedByFilter: { in: query, name: contacted_by, schema: { type: integer }, description: 'Only the leads contacted by that user (id)' }
 *     InBothFilter: { in: query, name: in_both, schema: { type: boolean }, description: 'Only leads present in 2 or more sources' }
 *     IndividualsFilter: { in: query, name: individuals, schema: { type: boolean }, description: 'false excludes individuals (personas naturales); true returns only individuals' }
 *     QFilter: { in: query, name: q, schema: { type: string }, description: 'Name, legal name or NIT' }
 *
 * /leads:
 *   get:
 *     tags: [Leads]
 *     summary: Lists the stored leads
 *     parameters:
 *       - $ref: '#/components/parameters/SearchFilter'
 *       - $ref: '#/components/parameters/MunicipalityFilter'
 *       - $ref: '#/components/parameters/DepartmentFilter'
 *       - $ref: '#/components/parameters/CategoryFilter'
 *       - $ref: '#/components/parameters/SourceFilter'
 *       - $ref: '#/components/parameters/ContactableFilter'
 *       - $ref: '#/components/parameters/ContactedFilter'
 *       - $ref: '#/components/parameters/MineFilter'
 *       - $ref: '#/components/parameters/StatusFilter'
 *       - $ref: '#/components/parameters/QualityFilter'
 *       - $ref: '#/components/parameters/ContactedByFilter'
 *       - $ref: '#/components/parameters/InBothFilter'
 *       - $ref: '#/components/parameters/IndividualsFilter'
 *       - $ref: '#/components/parameters/QFilter'
 *       - { in: query, name: limit, schema: { type: integer, default: 100, maximum: 1000 } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *     responses:
 *       200:
 *         description: A page of leads
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
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     leads: { type: array, items: { $ref: '#/components/schemas/Lead' } }
 *       400: { description: Invalid filter, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session or expired session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       429: { description: Too many requests, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /leads/export.csv:
 *   get:
 *     tags: [Leads]
 *     summary: Downloads the leads as CSV (opens in Excel with accents; headers in Spanish)
 *     parameters:
 *       - $ref: '#/components/parameters/SearchFilter'
 *       - $ref: '#/components/parameters/MunicipalityFilter'
 *       - $ref: '#/components/parameters/DepartmentFilter'
 *       - $ref: '#/components/parameters/CategoryFilter'
 *       - $ref: '#/components/parameters/SourceFilter'
 *       - $ref: '#/components/parameters/ContactableFilter'
 *       - $ref: '#/components/parameters/ContactedFilter'
 *       - $ref: '#/components/parameters/MineFilter'
 *       - $ref: '#/components/parameters/StatusFilter'
 *       - $ref: '#/components/parameters/QualityFilter'
 *       - $ref: '#/components/parameters/ContactedByFilter'
 *       - $ref: '#/components/parameters/InBothFilter'
 *       - $ref: '#/components/parameters/IndividualsFilter'
 *       - $ref: '#/components/parameters/QFilter'
 *       - { in: query, name: limit, schema: { type: integer, default: 100000, maximum: 100000 } }
 *     responses:
 *       200: { description: CSV file, content: { text/csv: { schema: { type: string } } } }
 *       400: { description: Invalid filter, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session or expired session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /leads/stats:
 *   get:
 *     tags: [Leads]
 *     summary: Leads, contactable and attributed leads per source
 *     responses:
 *       200:
 *         description: One row per source
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
 *                       source: { type: string }
 *                       leads: { type: integer }
 *                       contactables: { type: integer }
 *                       attributed: { type: integer, description: 'Leads whose first source was this one' }
 *       401: { description: No session or expired session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /leads/{id}:
 *   get:
 *     tags: [Leads]
 *     summary: A lead with the history of every source that brought it
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
 *                 data: { $ref: '#/components/schemas/LeadDetail' }
 *       400: { description: Invalid id, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session or expired session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Lead not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *
 * /leads/{id}/mark-contacted:
 *   post:
 *     tags: [Leads]
 *     summary: Marks a lead as contacted and assigns it to the session user
 *     description: If someone else already contacted it, responds 409 and does not reassign it. If it was the same user, responds 200 without changes.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Updated lead
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: integer, example: 200 }
 *                 data: { $ref: '#/components/schemas/Lead' }
 *       400: { description: Invalid id, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session or expired session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Lead not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       409: { description: Someone else already contacted it (details include contactedBy and contactedAt), content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
export const leadsDocs = 'leads';
