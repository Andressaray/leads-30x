/**
 * @swagger
 * tags:
 *   - name: Metrics
 *     description: |
 *       CPL per source and per channel, and the cost vs. quality comparison (Dapta qualification).
 *
 *       - Each cost is prorated by days within the period.
 *       - Per source (new leads of the period): direct cost + "general" split according to each source's leads + the
 *         cost of each contact channel split according to how many of its leads were contacted through it. CPL = cost / leads.
 *       - Per contact channel: channel cost / contacted leads, / replies and / high-quality leads.
 *       - Quality index (0–100): the qualification score; without a score, HIGH 85 · MEDIUM 60 · LOW 30 · DISCARDED 0.
 *
 * /metrics:
 *   get:
 *     tags: [Metrics]
 *     summary: Metrics of the period (by default, from the 1st of the current month to today, in Colombia time)
 *     parameters:
 *       - { in: query, name: from, schema: { type: string, format: date, example: '2026-10-01' } }
 *       - { in: query, name: to, schema: { type: string, format: date, example: '2026-10-31' } }
 *     responses:
 *       200: { description: '{ period, totals, bySource[], byChannel[], costs }' }
 *       400: { description: 'Invalid date, reversed period or longer than 3 years', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: No session, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
export const metricsDocs = 'metrics';
