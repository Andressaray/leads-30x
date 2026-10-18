import pino from 'pino';
import { environment } from '~config/environment';

function hasPinoPretty(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

// In development, readable logs (if pino-pretty is installed); in production, JSON.
export const logger = pino({
  level: environment.logLevel,
  ...(environment.nodeEnv === 'development' && hasPinoPretty()
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } }
    : {}),
});
