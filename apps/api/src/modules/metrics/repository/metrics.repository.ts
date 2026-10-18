// Metrics queries (plain SQL: they are aggregations). Range [start, end) in UTC.
import { prisma } from '~config/db/client';
import type { MetricChannel, ContactsBySourceDTO, ChannelDataDTO, SourceDataDTO } from '../types/metrics.types';

const n = (v: bigint | number | string | null) => (v === null ? 0 : Number(v));

// Quality index 0–100: the score if there is one; otherwise, by quality.
const INDEX = `COALESCE(l.score, CASE l.quality WHEN 'HIGH' THEN 85 WHEN 'MEDIUM' THEN 60 WHEN 'LOW' THEN 30 WHEN 'DISCARDED' THEN 0 END)`;

type FunnelRow = { contacted: bigint; replied: bigint; interested: bigint; qualified: bigint; high: bigint; index_sum: bigint | string | null };
const funnel = (f: FunnelRow) => ({
  contacted: n(f.contacted),
  replied: n(f.replied),
  interested: n(f.interested),
  qualified: n(f.qualified),
  high: n(f.high),
  indexSum: n(f.index_sum),
});

/** New leads of the period by the source that brought them first, and how they did afterwards. */
export async function findDataBySource(start: Date, end: Date): Promise<SourceDataDTO[]> {
  const rows = await prisma.$queryRawUnsafe<(FunnelRow & { source: string; leads: bigint; contactables: bigint })[]>(
    `SELECT l.origin_source AS source,
            COUNT(*) AS leads,
            COUNT(*) FILTER (WHERE l.contactable) AS contactables,
            COUNT(*) FILTER (WHERE l.contact_status <> 'PENDING') AS contacted,
            COUNT(*) FILTER (WHERE l.replied_at IS NOT NULL) AS replied,
            COUNT(*) FILTER (WHERE l.contact_status = 'INTERESTED') AS interested,
            COUNT(*) FILTER (WHERE l.quality IS NOT NULL) AS qualified,
            COUNT(*) FILTER (WHERE l.quality = 'HIGH') AS high,
            SUM(${INDEX}) AS index_sum
       FROM leads l
      WHERE l.created_at >= $1 AND l.created_at < $2
      GROUP BY l.origin_source`,
    start,
    end
  );
  return rows.map((f) => ({ source: f.source, leads: n(f.leads), contactables: n(f.contactables), ...funnel(f) }));
}

// Contacts of the period: the team's emails, WhatsApp messages and calls (history) and dispatches to Dapta.
const CONTACTS = `
  SELECT LOWER(i.channel::text) AS channel, i.lead_id, i.id::text AS contact
    FROM interactions i
   WHERE i.direction = 'OUTBOUND' AND i.status <> 'FAILED' AND i.channel IN ('EMAIL', 'WHATSAPP', 'CALL')
     AND i.created_at >= $1 AND i.created_at < $2
  UNION ALL
  SELECT 'dapta', q.lead_id, 'q' || q.id
    FROM qualifications q
   WHERE q.origin = 'DAPTA' AND q.status <> 'FAILED' AND q.created_at >= $1 AND q.created_at < $2`;

/** Per contact channel: how many contacts went out, to how many leads, how many replied through that channel and their quality. */
export async function findDataByChannel(start: Date, end: Date): Promise<ChannelDataDTO[]> {
  const rows = await prisma.$queryRawUnsafe<(FunnelRow & { channel: string; outreach: bigint })[]>(
    `WITH contacts AS (${CONTACTS}),
          by_lead AS (SELECT channel, lead_id, COUNT(*) AS outreach FROM contacts GROUP BY channel, lead_id),
          replies AS (
            SELECT LOWER(channel::text) AS channel, lead_id, BOOL_OR(result = 'INTERESTED') AS interested
              FROM interactions
             WHERE direction = 'INBOUND' AND result IN ('REPLIED', 'INTERESTED', 'NOT_INTERESTED')
               AND created_at >= $1 AND created_at < $2
             GROUP BY 1, 2)
     SELECT p.channel,
            SUM(p.outreach) AS outreach,
            COUNT(*) AS contacted,
            COUNT(r.lead_id) AS replied,
            COUNT(*) FILTER (WHERE r.interested) AS interested,
            COUNT(*) FILTER (WHERE l.quality IS NOT NULL) AS qualified,
            COUNT(*) FILTER (WHERE l.quality = 'HIGH') AS high,
            SUM(${INDEX}) AS index_sum
       FROM by_lead p
       JOIN leads l ON l.id = p.lead_id
       LEFT JOIN replies r ON r.channel = p.channel AND r.lead_id = p.lead_id
      GROUP BY p.channel`,
    start,
    end
  );
  return rows.map((f) => ({ channel: f.channel as MetricChannel, outreach: n(f.outreach), ...funnel(f) }));
}

/** Distinct leads contacted per channel and per the source of each lead. */
export async function findContactsBySource(start: Date, end: Date): Promise<ContactsBySourceDTO[]> {
  const rows = await prisma.$queryRawUnsafe<{ channel: string; source: string; leads: bigint }[]>(
    `WITH contacts AS (${CONTACTS})
     SELECT c.channel, l.origin_source AS source, COUNT(DISTINCT c.lead_id) AS leads
       FROM contacts c JOIN leads l ON l.id = c.lead_id
      GROUP BY 1, 2`,
    start,
    end
  );
  return rows.map((f) => ({ channel: f.channel as MetricChannel, source: f.source, leads: n(f.leads) }));
}
