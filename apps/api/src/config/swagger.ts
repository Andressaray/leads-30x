import path from 'node:path';
import swaggerJsdoc from 'swagger-jsdoc';
import { environment } from '~config/environment';

// Definición compartida. Cada módulo se documenta solo en modules/<modulo>/dosc/*.swagger.ts
// y este glob lo recoge automáticamente.
export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Leads Colombia API',
      version: '2.0.0',
      description:
        'Busca negocios por ciudad en fuentes públicas y gratuitas de Colombia (DANE, OpenStreetMap, RNT, SECOP II, REPS), los cruza y los guarda sin duplicados.',
    },
    servers: [{ url: environment.apiPrefix }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Token que devuelve POST /auth/login.' },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Descripción del error' },
            status: { type: 'integer', example: 400 },
            details: { description: 'Datos extra, cuando aplica' },
          },
          required: ['error', 'status'],
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [path.join(__dirname, '..', 'modules', '**', 'dosc', '*.swagger.{ts,js}')],
});
