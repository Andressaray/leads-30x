// Variables de entorno: se validan al arrancar y el proceso falla rápido si falta algo.

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor || !valor.trim()) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisa tu archivo .env (ver .env.example).`);
  }
  return valor.trim();
}

function secreto(nombre: string): string {
  const valor = requerida(nombre);
  if (valor.length < 32) throw new Error(`${nombre} debe tener al menos 32 caracteres (usa una cadena aleatoria larga).`);
  return valor;
}

function numero(nombre: string, porDefecto: number): number {
  const valor = process.env[nombre];
  if (valor === undefined || valor === '') return porDefecto;
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`La variable ${nombre} debe ser un número positivo.`);
  return n;
}

/** Como numero(), pero acepta 0 (para desactivar algo). */
function numeroOCero(nombre: string, porDefecto: number): number {
  const valor = process.env[nombre];
  if (valor === undefined || valor === '') return porDefecto;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) throw new Error(`La variable ${nombre} debe ser un número mayor o igual a 0.`);
  return n;
}

function booleano(nombre: string, porDefecto: boolean): boolean {
  const valor = process.env[nombre]?.trim().toLowerCase();
  if (!valor) return porDefecto;
  if (['true', '1', 'si', 'sí'].includes(valor)) return true;
  if (['false', '0', 'no'].includes(valor)) return false;
  throw new Error(`La variable ${nombre} debe ser true o false.`);
}

function lista(nombre: string): string[] | undefined {
  const valor = process.env[nombre];
  if (!valor) return undefined;
  const items = valor.split(',').map((s) => s.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

export interface Environment {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  databaseUrl: string;
  /** Firma de los tokens de sesión (JWT). Obligatoria. */
  jwtSecret: string;
  /** Duración de la sesión, en formato de jsonwebtoken (ej. 12h, 7d). */
  jwtExpiraEn: string;
  /** Correo o URL de contacto: Overpass pide identificar a quien consulta */
  contacto: string | undefined;
  userAgent: string;
  logLevel: string;
  rateLimitPorMinuto: number;
  busquedasPorMinuto: number;
  loginPorMinuto: number;
  osm: { endpoints: string[] | undefined; timeoutMs: number; presupuestoMs: number; radioRespaldoM: number; pausaReintentoMs: number };
  dane: { url: string | undefined; timeoutMs: number; consultasEnParalelo: number; pausaReintentoMs: number };
  /** Resultados de cada fuente reutilizables por municipio + filtro (0 = sin caché) */
  cache: { ttlMs: number; maxEntradas: number };
  /** Tope de espera por fuente dentro de una búsqueda: pasado este tiempo se marca como error */
  fuenteMaxMs: number;
  datosAbiertos: { appToken: string | undefined; timeoutMs: number; maxRegistros: number };
  /** Envío de correo. Sin host SMTP, en desarrollo los correos se simulan y en producción no se envían. */
  correo: {
    host: string | undefined;
    port: number;
    secure: boolean;
    user: string | undefined;
    pass: string | undefined;
    /** Remitente, ej. "Ventas Mi Empresa <ventas@miempresa.co>". */
    remitente: string | undefined;
    /** A dónde llegan las respuestas. Sin valor: al correo de quien envía. */
    responderA: string | undefined;
  };
  /** Nombre que firma los mensajes (la ley pide identificar a quien envía). */
  nombreEmpresa: string;
  /** URL pública de la API (para el enlace de "darse de baja" en los correos). */
  urlPublica: string | undefined;
  /** Respeta el horario y la frecuencia de la Ley 2300 de 2023 al contactar. */
  horarioLegal: boolean;
  /** Integración con Dapta (calificación de leads). */
  dapta: {
    /** URL del trigger de Flow Studio ("Public Route", con la autenticación en la URL). */
    flowUrl: string | undefined;
    /** Secreto que Dapta debe mandar al webhook de resultados. Sin él, el webhook no acepta nada. */
    webhookSecret: string | undefined;
    /** true si el flujo de Dapta llama al lead (se aplican las reglas de contacto y queda en el historial). */
    contacta: boolean;
    timeoutMs: number;
  };
}

export function cargarEnvironment(): Environment {
  const contacto = process.env.CONTACTO?.trim() || undefined;
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: numero('PORT', 3000),
    apiPrefix: process.env.API_PREFIX ?? '/api',
    databaseUrl: requerida('DATABASE_URL'),
    jwtSecret: secreto('JWT_SECRET'),
    jwtExpiraEn: process.env.JWT_EXPIRES_IN?.trim() || '12h',
    contacto,
    userAgent: `leads-colombia/2.0${contacto ? ` (${contacto})` : ''}`,
    logLevel: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
    rateLimitPorMinuto: numero('RATE_LIMIT_POR_MINUTO', 120),
    busquedasPorMinuto: numero('BUSQUEDAS_POR_MINUTO', 6),
    loginPorMinuto: numero('LOGIN_POR_MINUTO', 10),
    osm: {
      endpoints: lista('OVERPASS_URLS'),
      timeoutMs: numero('OSM_TIMEOUT_MS', 60000),
      presupuestoMs: numero('OSM_PRESUPUESTO_MS', 100000),
      radioRespaldoM: numero('OSM_RADIO_RESPALDO_M', 4000),
      pausaReintentoMs: numero('OSM_PAUSA_REINTENTO_MS', 1000),
    },
    dane: {
      url: process.env.DANE_URL?.trim() || undefined,
      timeoutMs: numero('DANE_TIMEOUT_MS', 60000),
      consultasEnParalelo: numero('DANE_CONSULTAS_EN_PARALELO', 3),
      pausaReintentoMs: numero('DANE_PAUSA_REINTENTO_MS', 1500),
    },
    cache: {
      ttlMs: numeroOCero('CACHE_FUENTES_MINUTOS', 1440) * 60000,
      maxEntradas: numeroOCero('CACHE_FUENTES_MAX', 100),
    },
    fuenteMaxMs: numero('FUENTE_MAX_MS', 150000),
    datosAbiertos: {
      appToken: process.env.DATOS_GOV_APP_TOKEN?.trim() || undefined,
      timeoutMs: numero('DATOS_GOV_TIMEOUT_MS', 60000),
      maxRegistros: numero('DATOS_GOV_MAX_REGISTROS', 20000),
    },
    correo: {
      host: process.env.SMTP_HOST?.trim() || undefined,
      port: numero('SMTP_PORT', 587),
      secure: booleano('SMTP_SECURE', false),
      user: process.env.SMTP_USER?.trim() || undefined,
      pass: process.env.SMTP_PASS || undefined,
      remitente: process.env.CORREO_REMITENTE?.trim() || undefined,
      responderA: process.env.CORREO_RESPONDER_A?.trim() || undefined,
    },
    nombreEmpresa: process.env.NOMBRE_EMPRESA?.trim() || 'Leads Colombia',
    urlPublica: process.env.URL_PUBLICA?.trim().replace(/\/$/, '') || undefined,
    horarioLegal: booleano('CONTACTO_HORARIO_LEGAL', true),
    dapta: {
      flowUrl: process.env.DAPTA_FLOW_URL?.trim() || undefined,
      webhookSecret: process.env.DAPTA_WEBHOOK_SECRET?.trim() || undefined,
      contacta: booleano('DAPTA_CONTACTA', true),
      timeoutMs: numero('DAPTA_TIMEOUT_MS', 15000),
    },
  };
}

export const environment: Environment = cargarEnvironment();
