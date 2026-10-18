// Entorno de pruebas: carga .env.test (si existe) y nunca usa la base de desarrollo.
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

const archivo = path.join(__dirname, '..', '..', '.env.test');
if (fs.existsSync(archivo)) dotenv.config({ path: archivo, override: true, quiet: true });

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'pruebas-pruebas-pruebas-pruebas-pruebas';
process.env.OSM_PAUSA_REINTENTO_MS = '1';
process.env.DANE_PAUSA_REINTENTO_MS = '1';
process.env.RATE_LIMIT_POR_MINUTO = '10000';
process.env.BUSQUEDAS_POR_MINUTO = '10000';
process.env.LOGIN_POR_MINUTO = '10000';
// Las pruebas de repositorio necesitan DATABASE_URL_TEST (una base desechable).
// El resto no se conecta a ninguna base, pero el cliente necesita una URL para construirse.
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? 'postgresql://localhost:5432/leads_test_sin_configurar';
