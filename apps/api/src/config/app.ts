// Construye la app: middlewares globales, montaje de rutas y manejador de errores (al final).

import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { environment } from '~config/environment';
import { swaggerSpec } from '~config/swagger';
import { HttpCode, handleError, handleSuccess } from '~response/index';
import { errorHandler, notFoundHandler } from 'middlewares/errorHandler';
import { verifyAuth } from 'middlewares/verifyAuth';
import { AuthRouter } from 'modules/auth/router';
import { BusquedasRouter } from 'modules/busquedas/router';
import { CalificacionesLeadRouter, DaptaRouter, DaptaWebhookRouter } from 'modules/calificaciones/router';
import { CatalogoRouter } from 'modules/catalogo/router';
import { BajasRouter, ContactosRouter } from 'modules/contactos/router';
import { CostosRouter } from 'modules/costos/router';
import { LeadsRouter } from 'modules/leads/router';
import { MetricasRouter } from 'modules/metricas/router';
import { PlantillasRouter } from 'modules/plantillas/router';
import { UsuariosRouter } from 'modules/usuarios/router';

export function crearApp(): Express {
  const app = express();
  const api = environment.apiPrefix;
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));

  const limitePorDefecto = rateLimit({
    windowMs: 60_000,
    limit: environment.rateLimitPorMinuto,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => handleError(res, HttpCode.TOO_MANY_REQUESTS, 'Demasiadas solicitudes. Intenta en un minuto.'),
  });
  // Buscar consulta servicios públicos con límite por IP: límite más estricto solo para crear búsquedas.
  const limiteBusquedas = rateLimit({
    windowMs: 60_000,
    limit: environment.busquedasPorMinuto,
    skip: (req) => req.method !== 'POST',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => handleError(res, HttpCode.TOO_MANY_REQUESTS, 'Demasiadas búsquedas. Intenta en un minuto.'),
  });

  app.get('/health', (_req, res) => handleSuccess(res, HttpCode.OK, { ok: true }));
  app.use(`${api}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get(`${api}/docs.json`, (_req, res) => {
    res.json(swaggerSpec);
  });

  // Login: límite estricto por IP contra adivinar contraseñas.
  const limiteLogin = rateLimit({
    windowMs: 60_000,
    limit: environment.loginPorMinuto,
    skip: (req) => req.method !== 'POST',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => handleError(res, HttpCode.TOO_MANY_REQUESTS, 'Demasiados intentos de inicio de sesión. Intenta en un minuto.'),
  });

  const auth = verifyAuth(environment.jwtSecret);
  app.use(`${api}/auth`, limitePorDefecto, limiteLogin, AuthRouter);
  app.use(`${api}/usuarios`, limitePorDefecto, auth, UsuariosRouter);
  app.use(`${api}/busquedas`, limitePorDefecto, limiteBusquedas, auth, BusquedasRouter);
  // Contactar (correo, WhatsApp, llamadas, respuestas) vive en su módulo pero cuelga de /leads/:id/…
  app.use(`${api}/leads`, limitePorDefecto, auth, ContactosRouter);
  app.use(`${api}/leads`, limitePorDefecto, auth, CalificacionesLeadRouter);
  app.use(`${api}/leads`, limitePorDefecto, auth, LeadsRouter);
  app.use(`${api}/plantillas`, limitePorDefecto, auth, PlantillasRouter);
  // Enlace de baja de los correos: lo abre el negocio contactado, así que no pide sesión.
  app.use(`${api}/bajas`, limitePorDefecto, BajasRouter);
  // Resultados de Dapta: sin sesión, con secreto (lo valida el dominio). Va antes de /dapta con sesión.
  app.use(`${api}/dapta/webhook`, limitePorDefecto, DaptaWebhookRouter);
  app.use(`${api}/dapta`, limitePorDefecto, auth, DaptaRouter);
  app.use(`${api}/costos`, limitePorDefecto, auth, CostosRouter);
  app.use(`${api}/metricas`, limitePorDefecto, auth, MetricasRouter);
  app.use(`${api}/catalogo`, limitePorDefecto, auth, CatalogoRouter);

  // Frontend (apps/web) ya compilado: en producción la API también sirve la SPA desde la raíz.
  // En desarrollo el frontend corre aparte con Vite (pnpm dev) y le hace proxy a /api.
  const web = path.join(__dirname, '..', '..', '..', 'web', 'build', 'client');
  const fallbackWeb = ['__spa-fallback.html', 'index.html'].map((f) => path.join(web, f)).find((f) => fs.existsSync(f));
  if (fallbackWeb) {
    app.use(express.static(web));
    app.get(/.*/, (req, res, next) => {
      if (req.path === '/health' || req.path.startsWith(`${api}/`)) return next();
      res.sendFile(fallbackWeb);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
