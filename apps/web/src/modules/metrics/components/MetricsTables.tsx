import { integer, COST_CHANNEL_NAME, pct, weights } from "../format";
import type { ChannelMetric, SourceMetric } from "../types";

function Quality({ index, highRate, qualified }: { index: number | null; highRate: number | null; qualified: number }) {
  if (index === null) return <span className="muted">Sin calificar</span>;
  return (
    <span className="quality-cell">
      <span className="quality-bar" aria-hidden="true">
        <span style={{ width: `${index}%` }} />
      </span>
      <b>{index}</b>
      <small>
        {pct(highRate)} alta · {integer(qualified)}
      </small>
    </span>
  );
}

/** "4 de 10 (40 %)" */
const ofTotal = (n: number, total: number) => (total ? `${integer(n)} (${pct(n / total)})` : integer(n));

export function SourcesTable({ rows }: { rows: SourceMetric[] }) {
  return (
    <div className="table">
      <table className="metrics-table">
        <thead>
          <tr>
            <th>Fuente</th>
            <th className="num">Leads</th>
            <th className="num">Contactados</th>
            <th className="num">Respondieron</th>
            <th>Calidad</th>
            <th className="num">Costo</th>
            <th className="num">CPL</th>
            <th className="num" title="Costo / leads que respondieron">Costo por respuesta</th>
            <th className="num" title="Costo / leads con calificación alta">Costo por lead alta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.source} className={f.leads === 0 && f.cost.total === 0 ? "empty-row" : undefined}>
              <td>
                <b>{COST_CHANNEL_NAME[f.source as keyof typeof COST_CHANNEL_NAME] ?? f.source}</b>
              </td>
              <td className="num">{integer(f.leads)}</td>
              <td className="num">{ofTotal(f.contacted, f.leads)}</td>
              <td className="num">{ofTotal(f.replied, f.contacted)}</td>
              <td>
                <Quality index={f.qualityIndex} highRate={f.highRate} qualified={f.qualified} />
              </td>
              <td className="num" title={`Directo ${weights(f.cost.direct)} · general ${weights(f.cost.general)} · contacto ${weights(f.cost.contact)}`}>
                {weights(f.cost.total)}
              </td>
              <td className="num">
                <b>{weights(f.cpl)}</b>
              </td>
              <td className="num">{weights(f.costPerReply)}</td>
              <td className="num">{weights(f.costPerHighLead)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChannelsTable({ rows }: { rows: ChannelMetric[] }) {
  return (
    <div className="table">
      <table className="metrics-table">
        <thead>
          <tr>
            <th>Canal</th>
            <th className="num">Envíos</th>
            <th className="num">Contactados</th>
            <th className="num">Respondieron</th>
            <th>Calidad</th>
            <th className="num">Costo</th>
            <th className="num">Costo por contactado</th>
            <th className="num" title="Costo / leads que respondieron">Costo por respuesta</th>
            <th className="num" title="Costo / leads con calificación alta">Costo por lead alta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.channel} className={c.outreach === 0 && c.cost === 0 ? "empty-row" : undefined}>
              <td>
                <b>{COST_CHANNEL_NAME[c.channel]}</b>
              </td>
              <td className="num">{integer(c.outreach)}</td>
              <td className="num">{integer(c.contactedLeads)}</td>
              <td className="num">{ofTotal(c.replied, c.contactedLeads)}</td>
              <td>
                <Quality index={c.qualityIndex} highRate={c.highRate} qualified={c.qualified} />
              </td>
              <td className="num">{weights(c.cost)}</td>
              <td className="num">
                <b>{weights(c.costPerContact)}</b>
              </td>
              <td className="num">{weights(c.costPerReply)}</td>
              <td className="num">{weights(c.costPerHighLead)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
