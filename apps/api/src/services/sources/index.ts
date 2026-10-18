// Source registry.
// - Built-in: coded here (DANE, OSM, RNT, SECOP, REPS). To add a new
//   coded one: create a file that implements LeadSource and add it in createSources.
// - Custom: datos.gov.co datasets the team adds from /api/sources,
//   without code (see ./custom).

import type { LeadSource } from '~types/source.types';
import type { Environment } from '~config/environment';
import type { FetchLike } from './http';
import { createSocrataClient } from './socrata';
import { createDaneSource } from './dane';
import { createOsmSource } from './osm';
import { createRntSource } from './rnt';
import { createSecopSource } from './secop';
import { createRepsSource } from './reps';
import { createCustomSource, inspectDataset, type OpenDataDefinition, type InspectionOptions } from './custom';

export function createDatosGovClient(env: Environment, fetchImpl?: FetchLike) {
  return createSocrataClient({
    appToken: env.openData.appToken,
    timeoutMs: env.openData.timeoutMs,
    maxRecords: env.openData.maxRecords,
    userAgent: env.userAgent,
    fetchImpl,
  });
}

/** The five built-in sources. */
export function createSources(env: Environment, fetchImpl?: FetchLike): LeadSource[] {
  const socrata = createDatosGovClient(env, fetchImpl);
  return [
    createDaneSource({
      url: env.dane.url,
      timeoutMs: env.dane.timeoutMs,
      parallelQueries: env.dane.parallelQueries,
      retryPauseMs: env.dane.retryPauseMs,
      userAgent: env.userAgent,
      fetchImpl,
    }),
    createOsmSource({ ...env.osm, endpoints: env.osm.endpoints, userAgent: env.userAgent, fetchImpl }),
    createRntSource(socrata),
    createSecopSource(socrata),
    createRepsSource(socrata),
  ];
}

/** Factory of custom sources (datos.gov.co datasets) with the environment configuration. */
export function createCustomSourceFactory(env: Environment, fetchImpl?: FetchLike) {
  const socrata = createDatosGovClient(env, fetchImpl);
  const inspectionOptions: InspectionOptions = {
    appToken: env.openData.appToken,
    timeoutMs: Math.min(env.openData.timeoutMs, 30000),
    userAgent: env.userAgent,
    fetchImpl,
  };
  return {
    create: (d: OpenDataDefinition) => createCustomSource(socrata, d),
    inspect: (dataset: string) => inspectDataset(dataset, inspectionOptions),
  };
}

export type CustomSourceFactory = ReturnType<typeof createCustomSourceFactory>;

export { SourceError } from './http';
