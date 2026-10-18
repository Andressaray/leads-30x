// Environment variables: validated at startup, and the process fails fast if something is missing.

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing environment variable ${name}. Check your .env file (see .env.example).`);
  }
  return value.trim();
}

function secret(name: string): string {
  const value = required(name);
  if (value.length < 32) throw new Error(`${name} must be at least 32 characters long (use a long random string).`);
  return value;
}

function number(name: string, byDefault: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') return byDefault;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`The variable ${name} must be a positive number.`);
  return n;
}

/** Like number(), but accepts 0 (to turn something off). */
function numberOrZero(name: string, byDefault: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') return byDefault;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`The variable ${name} must be a number greater than or equal to 0.`);
  return n;
}

function boolean(name: string, byDefault: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return byDefault;
  if (['true', '1', 'si', 'sí'].includes(value)) return true;
  if (['false', '0', 'no'].includes(value)) return false;
  throw new Error(`The variable ${name} must be true or false.`);
}

function list(name: string): string[] | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const items = value.split(',').map((s) => s.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

export interface Environment {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  databaseUrl: string;
  /** Signing key of the session tokens (JWT). Required. */
  jwtSecret: string;
  /** Session duration, in jsonwebtoken format (e.g. 12h, 7d). */
  jwtExpiresIn: string;
  /** Contact email or URL: Overpass asks clients to identify themselves */
  contact: string | undefined;
  userAgent: string;
  logLevel: string;
  rateLimitPerMinute: number;
  searchesPerMinute: number;
  loginPerMinute: number;
  osm: { endpoints: string[] | undefined; timeoutMs: number; budgetMs: number; fallbackRadiusM: number; retryPauseMs: number };
  dane: { url: string | undefined; timeoutMs: number; parallelQueries: number; retryPauseMs: number };
  /** Each source's results are reusable per municipality + filter (0 = no cache) */
  cache: { ttlMs: number; maxEntries: number };
  /** Wait limit per source within a search: after this time it is marked as an error */
  sourceMaxMs: number;
  openData: { appToken: string | undefined; timeoutMs: number; maxRecords: number };
  /** Email sending. Without an SMTP host, emails are simulated in development and not sent in production. */
  email: {
    host: string | undefined;
    port: number;
    secure: boolean;
    user: string | undefined;
    pass: string | undefined;
    /** Sender, e.g. "Ventas Mi Empresa <ventas@miempresa.co>". */
    sender: string | undefined;
    /** Where replies arrive. Empty: to the sender's email. */
    replyTo: string | undefined;
  };
  /** Name that signs the messages (the law requires identifying the sender). */
  companyName: string;
  /** Public URL of the API (for the "unsubscribe" link in the emails). */
  publicUrl: string | undefined;
  /** Respect the hours and frequency of Ley 2300 de 2023 when contacting. */
  legalHours: boolean;
  /** Dapta integration (lead qualification). */
  dapta: {
    /** Flow Studio trigger URL ("Public Route", with the authentication in the URL). */
    flowUrl: string | undefined;
    /** Secret Dapta must send to the results webhook. Without it, the webhook accepts nothing. */
    webhookSecret: string | undefined;
    /** true if the Dapta flow calls the lead (the contact rules apply and it is recorded in the history). */
    contacts: boolean;
    timeoutMs: number;
  };
}

export function loadEnvironment(): Environment {
  const contact = process.env.CONTACT?.trim() || undefined;
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: number('PORT', 3000),
    apiPrefix: process.env.API_PREFIX ?? '/api',
    databaseUrl: required('DATABASE_URL'),
    jwtSecret: secret('JWT_SECRET'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN?.trim() || '12h',
    contact,
    userAgent: `leads-colombia/2.0${contact ? ` (${contact})` : ''}`,
    logLevel: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
    rateLimitPerMinute: number('RATE_LIMIT_PER_MINUTE', 120),
    searchesPerMinute: number('SEARCHES_PER_MINUTE', 6),
    loginPerMinute: number('LOGIN_PER_MINUTE', 10),
    osm: {
      endpoints: list('OVERPASS_URLS'),
      timeoutMs: number('OSM_TIMEOUT_MS', 60000),
      budgetMs: number('OSM_BUDGET_MS', 100000),
      fallbackRadiusM: number('OSM_FALLBACK_RADIUS_M', 4000),
      retryPauseMs: number('OSM_RETRY_PAUSE_MS', 1000),
    },
    dane: {
      url: process.env.DANE_URL?.trim() || undefined,
      timeoutMs: number('DANE_TIMEOUT_MS', 60000),
      parallelQueries: number('DANE_PARALLEL_QUERIES', 3),
      retryPauseMs: number('DANE_RETRY_PAUSE_MS', 1500),
    },
    cache: {
      ttlMs: numberOrZero('SOURCE_CACHE_MINUTES', 1440) * 60000,
      maxEntries: numberOrZero('SOURCE_CACHE_MAX', 100),
    },
    sourceMaxMs: number('SOURCE_MAX_MS', 150000),
    openData: {
      appToken: process.env.DATOS_GOV_APP_TOKEN?.trim() || undefined,
      timeoutMs: number('DATOS_GOV_TIMEOUT_MS', 60000),
      maxRecords: number('DATOS_GOV_MAX_RECORDS', 20000),
    },
    email: {
      host: process.env.SMTP_HOST?.trim() || undefined,
      port: number('SMTP_PORT', 587),
      secure: boolean('SMTP_SECURE', false),
      user: process.env.SMTP_USER?.trim() || undefined,
      pass: process.env.SMTP_PASS || undefined,
      sender: process.env.EMAIL_FROM?.trim() || undefined,
      replyTo: process.env.EMAIL_REPLY_TO?.trim() || undefined,
    },
    companyName: process.env.COMPANY_NAME?.trim() || 'Leads Colombia',
    publicUrl: process.env.PUBLIC_URL?.trim().replace(/\/$/, '') || undefined,
    legalHours: boolean('CONTACT_LEGAL_HOURS', true),
    dapta: {
      flowUrl: process.env.DAPTA_FLOW_URL?.trim() || undefined,
      webhookSecret: process.env.DAPTA_WEBHOOK_SECRET?.trim() || undefined,
      contacts: boolean('DAPTA_CALLS', true),
      timeoutMs: number('DAPTA_TIMEOUT_MS', 15000),
    },
  };
}

export const environment: Environment = loadEnvironment();
