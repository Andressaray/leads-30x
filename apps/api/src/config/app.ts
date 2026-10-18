// Builds the app: global middlewares, route mounting and the error handler (last).

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
import { SearchesRouter } from 'modules/searches/router';
import { LeadQualificationsRouter, DaptaRouter, DaptaWebhookRouter } from 'modules/qualifications/router';
import { CatalogRouter } from 'modules/catalog/router';
import { UnsubscribeRouter, OutreachRouter } from 'modules/outreach/router';
import { CostsRouter } from 'modules/costs/router';
import { LeadsRouter } from 'modules/leads/router';
import { MetricsRouter } from 'modules/metrics/router';
import { TemplatesRouter } from 'modules/templates/router';
import { UsersRouter } from 'modules/users/router';

export function createApp(): Express {
  const app = express();
  const api = environment.apiPrefix;
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));

  const defaultLimit = rateLimit({
    windowMs: 60_000,
    limit: environment.rateLimitPerMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => handleError(res, HttpCode.TOO_MANY_REQUESTS, 'Demasiadas solicitudes. Intenta en un minuto.'),
  });
  // Searching queries public services with per-IP limits: a stricter limit only for creating searches.
  const searchesLimit = rateLimit({
    windowMs: 60_000,
    limit: environment.searchesPerMinute,
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

  // Login: strict per-IP limit against password guessing.
  const loginLimit = rateLimit({
    windowMs: 60_000,
    limit: environment.loginPerMinute,
    skip: (req) => req.method !== 'POST',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => handleError(res, HttpCode.TOO_MANY_REQUESTS, 'Demasiados intentos de inicio de sesión. Intenta en un minuto.'),
  });

  const auth = verifyAuth(environment.jwtSecret);
  app.use(`${api}/auth`, defaultLimit, loginLimit, AuthRouter);
  app.use(`${api}/users`, defaultLimit, auth, UsersRouter);
  app.use(`${api}/searches`, defaultLimit, searchesLimit, auth, SearchesRouter);
  // Outreach (email, WhatsApp, calls, replies) lives in its own module but hangs from /leads/:id/…
  app.use(`${api}/leads`, defaultLimit, auth, OutreachRouter);
  app.use(`${api}/leads`, defaultLimit, auth, LeadQualificationsRouter);
  app.use(`${api}/leads`, defaultLimit, auth, LeadsRouter);
  app.use(`${api}/templates`, defaultLimit, auth, TemplatesRouter);
  // Unsubscribe link in the emails: the contacted business opens it, so it does not require a session.
  app.use(`${api}/unsubscribe`, defaultLimit, UnsubscribeRouter);
  // Dapta results: no session, with a secret (validated by the domain). Goes before /dapta with a session.
  app.use(`${api}/dapta/webhook`, defaultLimit, DaptaWebhookRouter);
  app.use(`${api}/dapta`, defaultLimit, auth, DaptaRouter);
  app.use(`${api}/costs`, defaultLimit, auth, CostsRouter);
  app.use(`${api}/metrics`, defaultLimit, auth, MetricsRouter);
  app.use(`${api}/catalog`, defaultLimit, auth, CatalogRouter);

  // Built frontend (apps/web): in production the API also serves the SPA from the root.
  // In development the frontend runs separately with Vite (pnpm dev) and proxies /api.
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
