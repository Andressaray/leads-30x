/**
 * @swagger
 * tags:
 *   - name: Métricas
 *     description: |
 *       CPL por fuente y por canal, y la comparación de costo contra calidad (calificación de Dapta).
 *
 *       - Cada costo se prorratea por días dentro del periodo.
 *       - Por fuente (leads nuevos del periodo): costo directo + "general" repartido según los leads de cada fuente + el
 *         costo de cada canal de contacto repartido según cuántos de sus leads se contactaron por él. CPL = costo / leads.
 *       - Por canal de contacto: costo del canal / leads contactados, / respuestas y / leads de calidad alta.
 *       - Índice de calidad (0–100): el puntaje de la calificación; sin puntaje, ALTA 85 · MEDIA 60 · BAJA 30 · DESCARTADO 0.
 *
 * /metricas:
 *   get:
 *     tags: [Métricas]
 *     summary: Métricas del periodo (por defecto, del 1 del mes en curso a hoy, en hora de Colombia)
 *     parameters:
 *       - { in: query, name: desde, schema: { type: string, format: date, example: '2026-10-01' } }
 *       - { in: query, name: hasta, schema: { type: string, format: date, example: '2026-10-31' } }
 *     responses:
 *       200: { description: '{ periodo, totales, porFuente[], porCanal[], costos }' }
 *       400: { description: 'Fecha inválida, periodo al revés o de más de 3 años', content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Sin sesión, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
export const metricasDocs = 'metricas';
