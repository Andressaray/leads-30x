// Test environment: loads .env.test (if it exists) and never uses the development database.
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

const file = path.join(__dirname, '..', '..', '.env.test');
if (fs.existsSync(file)) dotenv.config({ path: file, override: true, quiet: true });

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'testing-testing-testing-testing-testing';
process.env.OSM_RETRY_PAUSE_MS = '1';
process.env.DANE_RETRY_PAUSE_MS = '1';
process.env.RATE_LIMIT_PER_MINUTE = '10000';
process.env.SEARCHES_PER_MINUTE = '10000';
process.env.LOGIN_PER_MINUTE = '10000';
// Repository tests need DATABASE_URL_TEST (a disposable database).
// The rest do not connect to any database, but the client needs a URL to be built.
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? 'postgresql://localhost:5432/leads_test_sin_configurar';
