// Registro de fuentes.
// - Integradas: programadas aquí (DANE, OSM, RNT, SECOP, REPS). Para sumar una nueva
//   programada: crea un archivo que implemente FuenteLeads y agrégala en crearFuentes.
// - Personalizadas: datasets de datos.gov.co que el equipo agrega desde /api/fuentes,
//   sin programar (ver ./personalizada).

import type { FuenteLeads } from '~types/fuente.types';
import type { Environment } from '~config/environment';
import type { FetchLike } from './http';
import { crearClienteSocrata } from './socrata';
import { crearFuenteDane } from './dane';
import { crearFuenteOsm } from './osm';
import { crearFuenteRnt } from './rnt';
import { crearFuenteSecop } from './secop';
import { crearFuenteReps } from './reps';
import { crearFuentePersonalizada, inspeccionarDataset, type DefinicionDatosAbiertos, type OpcionesInspeccion } from './personalizada';

export function crearConsultorDatosGov(env: Environment, fetchImpl?: FetchLike) {
  return crearClienteSocrata({
    appToken: env.datosAbiertos.appToken,
    timeoutMs: env.datosAbiertos.timeoutMs,
    maxRegistros: env.datosAbiertos.maxRegistros,
    userAgent: env.userAgent,
    fetchImpl,
  });
}

/** Las cinco fuentes integradas. */
export function crearFuentes(env: Environment, fetchImpl?: FetchLike): FuenteLeads[] {
  const socrata = crearConsultorDatosGov(env, fetchImpl);
  return [
    crearFuenteDane({
      url: env.dane.url,
      timeoutMs: env.dane.timeoutMs,
      consultasEnParalelo: env.dane.consultasEnParalelo,
      pausaReintentoMs: env.dane.pausaReintentoMs,
      userAgent: env.userAgent,
      fetchImpl,
    }),
    crearFuenteOsm({ ...env.osm, endpoints: env.osm.endpoints, userAgent: env.userAgent, fetchImpl }),
    crearFuenteRnt(socrata),
    crearFuenteSecop(socrata),
    crearFuenteReps(socrata),
  ];
}

/** Fábrica de fuentes personalizadas (datasets de datos.gov.co) con la configuración del entorno. */
export function crearFabricaPersonalizadas(env: Environment, fetchImpl?: FetchLike) {
  const socrata = crearConsultorDatosGov(env, fetchImpl);
  const opcionesInspeccion: OpcionesInspeccion = {
    appToken: env.datosAbiertos.appToken,
    timeoutMs: Math.min(env.datosAbiertos.timeoutMs, 30000),
    userAgent: env.userAgent,
    fetchImpl,
  };
  return {
    crear: (d: DefinicionDatosAbiertos) => crearFuentePersonalizada(socrata, d),
    inspeccionar: (dataset: string) => inspeccionarDataset(dataset, opcionesInspeccion),
  };
}

export type FabricaPersonalizadas = ReturnType<typeof crearFabricaPersonalizadas>;

export { ErrorFuente } from './http';
