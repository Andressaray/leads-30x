// Entry point: loads and validates the environment, and starts the server.
import 'dotenv/config';
import { environment } from '~config/environment';
import { createApp } from '~config/app';
import { prisma } from '~config/db/client';
import { logger } from '~config/logger';
import { closeUnfinishedSearches } from 'modules/searches/repository/searches.repository';

async function start(): Promise<void> {
  await prisma.$connect();
  const unfinished = await closeUnfinishedSearches();
  if (unfinished) logger.warn(`${unfinished} search(es) were left unfinished in the last run; they were marked as failed.`);
  const app = createApp();
  const server = app.listen(environment.port, () => {
    logger.info(`Leads Colombia listening on http://localhost:${environment.port}`);
    logger.info(`Docs: http://localhost:${environment.port}${environment.apiPrefix}/docs`);
  });

  const close = () => {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}

start().catch((err) => {
  logger.error(err, 'The server could not start');
  process.exit(1);
});
