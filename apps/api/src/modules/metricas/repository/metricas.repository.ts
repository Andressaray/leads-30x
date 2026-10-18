// Consultas de métricas (SQL directo: son agregaciones). Rango [inicio, fin) en UTC.
import { prisma } from '~config/db/client';
import type { CanalMetrica, ContactosPorFuenteDTO, DatosCanalDTO, DatosFuenteDTO } from '../types/metricas.types';

const n = (v: bigint | number | string | null) => (v === null ? 0 : Number(v));

// Índice de calidad 0–100: el puntaje si vino; si no, según la calidad.
const INDICE = `COALESCE(l.puntaje, CASE l.calidad WHEN 'ALTA' THEN 85 WHEN 'MEDIA' THEN 60 WHEN 'BAJA' THEN 30 WHEN 'DESCARTADO' THEN 0 END)`;

type FilaEmbudo = { contactados: bigint; respondieron: bigint; interesados: bigint; calificados: bigint; alta: bigint; indice_suma: bigint | string | null };
const embudo = (f: FilaEmbudo) => ({
  contactados: n(f.contactados),
  respondieron: n(f.respondieron),
  interesados: n(f.interesados),
  calificados: n(f.calificados),
  alta: n(f.alta),
  indiceSuma: n(f.indice_suma),
});

/** Leads nuevos del periodo por la fuente que los trajo primero, y cómo les fue después. */
export async function findDatosPorFuente(inicio: Date, fin: Date): Promise<DatosFuenteDTO[]> {
  const filas = await prisma.$queryRawUnsafe<(FilaEmbudo & { fuente: string; leads: bigint; contactables: bigint })[]>(
    `SELECT l.fuente_origen AS fuente,
            COUNT(*) AS leads,
            COUNT(*) FILTER (WHERE l.contactable) AS contactables,
            COUNT(*) FILTER (WHERE l.estado_contacto <> 'PENDIENTE') AS contactados,
            COUNT(*) FILTER (WHERE l.respondio_en IS NOT NULL) AS respondieron,
            COUNT(*) FILTER (WHERE l.estado_contacto = 'INTERESADO') AS interesados,
            COUNT(*) FILTER (WHERE l.calidad IS NOT NULL) AS calificados,
            COUNT(*) FILTER (WHERE l.calidad = 'ALTA') AS alta,
            SUM(${INDICE}) AS indice_suma
       FROM leads l
      WHERE l.created_at >= $1 AND l.created_at < $2
      GROUP BY l.fuente_origen`,
    inicio,
    fin
  );
  return filas.map((f) => ({ fuente: f.fuente, leads: n(f.leads), contactables: n(f.contactables), ...embudo(f) }));
}

// Contactos del periodo: correo, WhatsApp y llamadas del equipo (historial) y envíos a Dapta.
const CONTACTOS = `
  SELECT LOWER(i.canal::text) AS canal, i.lead_id, i.id::text AS contacto
    FROM interacciones i
   WHERE i.sentido = 'SALIENTE' AND i.estado <> 'FALLIDO' AND i.canal IN ('EMAIL', 'WHATSAPP', 'LLAMADA')
     AND i.created_at >= $1 AND i.created_at < $2
  UNION ALL
  SELECT 'dapta', c.lead_id, 'c' || c.id
    FROM calificaciones c
   WHERE c.origen = 'DAPTA' AND c.estado <> 'FALLIDO' AND c.created_at >= $1 AND c.created_at < $2`;

/** Por canal de contacto: cuántos contactos salieron, a cuántos leads, cuántos respondieron por ese canal y su calidad. */
export async function findDatosPorCanal(inicio: Date, fin: Date): Promise<DatosCanalDTO[]> {
  const filas = await prisma.$queryRawUnsafe<(FilaEmbudo & { canal: string; contactos: bigint })[]>(
    `WITH contactos AS (${CONTACTOS}),
          por_lead AS (SELECT canal, lead_id, COUNT(*) AS contactos FROM contactos GROUP BY canal, lead_id),
          respuestas AS (
            SELECT LOWER(canal::text) AS canal, lead_id, BOOL_OR(resultado = 'INTERESADO') AS interesado
              FROM interacciones
             WHERE sentido = 'ENTRANTE' AND resultado IN ('RESPONDIO', 'INTERESADO', 'NO_INTERESADO')
               AND created_at >= $1 AND created_at < $2
             GROUP BY 1, 2)
     SELECT p.canal,
            SUM(p.contactos) AS contactos,
            COUNT(*) AS contactados,
            COUNT(r.lead_id) AS respondieron,
            COUNT(*) FILTER (WHERE r.interesado) AS interesados,
            COUNT(*) FILTER (WHERE l.calidad IS NOT NULL) AS calificados,
            COUNT(*) FILTER (WHERE l.calidad = 'ALTA') AS alta,
            SUM(${INDICE}) AS indice_suma
       FROM por_lead p
       JOIN leads l ON l.id = p.lead_id
       LEFT JOIN respuestas r ON r.canal = p.canal AND r.lead_id = p.lead_id
      GROUP BY p.canal`,
    inicio,
    fin
  );
  return filas.map((f) => ({ canal: f.canal as CanalMetrica, contactos: n(f.contactos), ...embudo(f) }));
}

/** Leads distintos contactados por canal y por la fuente de cada lead. */
export async function findContactosPorFuente(inicio: Date, fin: Date): Promise<ContactosPorFuenteDTO[]> {
  const filas = await prisma.$queryRawUnsafe<{ canal: string; fuente: string; leads: bigint }[]>(
    `WITH contactos AS (${CONTACTOS})
     SELECT c.canal, l.fuente_origen AS fuente, COUNT(DISTINCT c.lead_id) AS leads
       FROM contactos c JOIN leads l ON l.id = c.lead_id
      GROUP BY 1, 2`,
    inicio,
    fin
  );
  return filas.map((f) => ({ canal: f.canal as CanalMetrica, fuente: f.fuente, leads: n(f.leads) }));
}
