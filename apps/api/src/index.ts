// Punto de entrada: carga y valida el entorno, y levanta el servidor.
import 'dotenv/config';
import { environment } from '~config/environment';
import { crearApp } from '~config/app';
import { prisma } from '~config/db/client';
import { logger } from '~config/logger';
import { cerrarBusquedasInconclusas } from 'modules/busquedas/repository/busquedas.repository';

async function iniciar(): Promise<void> {
  await prisma.$connect();
  const inconclusas = await cerrarBusquedasInconclusas();
  if (inconclusas) logger.warn(`${inconclusas} búsqueda(s) quedaron a medias en el último arranque; se marcaron como fallidas.`);
  const app = crearApp();
  const servidor = app.listen(environment.port, () => {
    logger.info(`Leads Colombia escuchando en http://localhost:${environment.port}`);
    logger.info(`Documentación: http://localhost:${environment.port}${environment.apiPrefix}/docs`);
  });

  const cerrar = () => {
    servidor.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

iniciar().catch((err) => {
  logger.error(err, 'No se pudo iniciar el servidor');
  process.exit(1);
});
