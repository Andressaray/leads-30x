import pino from 'pino';
import { environment } from '~config/environment';

function hayPinoPretty(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

// En desarrollo, logs legibles (si pino-pretty está instalado); en producción, JSON.
export const logger = pino({
  level: environment.logLevel,
  ...(environment.nodeEnv === 'development' && hayPinoPretty()
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } }
    : {}),
});
