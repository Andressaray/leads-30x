// Points 3 and 4: how much each lead costs per source and per channel, and how much it is worth (quality according to Dapta).
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useSession } from "@/shared/hooks/use-session";
import { errorMessage } from "@/shared/lib/http";
import { cn } from "@/shared/lib/cn";
import { buildMeta } from "@/shared/seo/meta";
import { Notice, Skeleton } from "@/shared/ui";
import { Costs } from "./components/Costs";
import { CostQualityChart, type ChartPoint } from "./components/CostQualityChart";
import { ChannelsTable, SourcesTable } from "./components/MetricsTables";
import { integer, COST_CHANNEL_NAME, period as quickPeriod, weights } from "./format";
import { listCosts, getMetrics } from "./services/metrics.service";
import type { Cost, Metrics } from "./types";

export const meta = () => buildMeta({ title: "Métricas" });

const DATE = /^\d{4}-\d{2}-\d{2}$/;
type View = "source" | "channel";

export default function MetricsPage() {
  const isAdmin = useSession()?.user.role === "ADMIN";
  const [params, setParams] = useSearchParams();
  const byDefault = quickPeriod("month");
  const from = DATE.test(params.get("from") ?? "") ? params.get("from")! : byDefault.from;
  const to = DATE.test(params.get("to") ?? "") ? params.get("to")! : byDefault.to;
  const view: View = params.get("view") === "channel" ? "channel" : "source";

  const [metrics, setMetrics] = useState<{ key: string; data: Metrics | null; error: string | null } | null>(null);
  const [costs, setCosts] = useState<{ data: Cost[] | null; error: string | null }>({ data: null, error: null });
  const [version, setVersion] = useState(0);
  const key = `${from}|${to}|${version}`;

  useEffect(() => {
    const control = new AbortController();
    getMetrics(from, to, control.signal).then(
      (data) => setMetrics({ key, data, error: null }),
      (err: unknown) => !control.signal.aborted && setMetrics({ key, data: null, error: errorMessage(err) }),
    );
    listCosts(from, to).then(
      (data) => setCosts({ data, error: null }),
      (err: unknown) => setCosts({ data: null, error: errorMessage(err) }),
    );
    return () => control.abort();
  }, [key, from, to]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const change = (c: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const sig = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(c)) {
          if (v === null) sig.delete(k);
          else sig.set(k, v);
        }
        return sig;
      },
      { replace: true },
    );

  const loading = metrics?.key !== key;
  const m = metrics?.data ?? null;
  const presets = [
    { id: "month", label: "Este mes", ...quickPeriod("month") },
    { id: "last-month", label: "Mes pasado", ...quickPeriod("last-month") },
    { id: "90", label: "Últimos 90 días", ...quickPeriod("90") },
  ];

  const points: ChartPoint[] = !m
    ? []
    : view === "source"
      ? m.bySource.map((f) => ({ id: f.source, name: COST_CHANNEL_NAME[f.source as keyof typeof COST_CHANNEL_NAME] ?? f.source, cost: f.cost.total > 0 ? f.cpl : null, quality: f.qualityIndex, leads: f.leads, qualified: f.qualified }))
      : m.byChannel.map((c) => ({ id: c.channel, name: COST_CHANNEL_NAME[c.channel], cost: c.cost > 0 ? c.costPerContact : null, quality: c.qualityIndex, leads: c.contactedLeads, qualified: c.qualified }));

  return (
    <section>
      <header className="page-header">
        <h1>Métricas</h1>
        <p className="sub">
          Cuánto cuesta cada lead según la fuente donde se encontró y el canal por el que se contactó, y qué tan bueno resultó según la
          calificación de Dapta.
        </p>
      </header>

      <div className="period-bar">
        <div className="tabs" role="group" aria-label="Periodo">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn("tab", from === p.from && to === p.to && "active")}
              aria-pressed={from === p.from && to === p.to}
              onClick={() => change({ from: p.from, to: p.to })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="date-range">
          <label>
            Desde
            <input type="date" value={from} max={to} onChange={(e) => e.target.value && change({ from: e.target.value })} />
          </label>
          <label>
            Hasta
            <input type="date" value={to} min={from} onChange={(e) => e.target.value && change({ to: e.target.value })} />
          </label>
        </div>
      </div>

      {metrics?.error && !loading && <Notice type="error" title="No se pudieron calcular las métricas." details={[metrics.error]} />}

      {loading && !m && (
        <div className="kpis">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="kpi">
              <Skeleton width="60%" height={12} />
              <Skeleton width="80%" height={26} />
            </div>
          ))}
        </div>
      )}

      {m && (
        <div className={cn("metrics", loading && "reloading")}>
          <div className="kpis">
            <div className="kpi">
              <span>Leads nuevos</span>
              <b>{integer(m.totals.leads)}</b>
              <small>
                {integer(m.totals.contacted)} contactados · {integer(m.totals.replied)} respondieron
              </small>
            </div>
            <div className="kpi">
              <span>Costo total</span>
              <b>{weights(m.totals.totalCost)}</b>
              <small>{m.period.days} días</small>
            </div>
            <div className="kpi kpi-main">
              <span>Costo por lead (CPL)</span>
              <b>{weights(m.totals.cpl)}</b>
              <small>costo total / leads nuevos</small>
            </div>
            <div className="kpi">
              <span>Costo por respuesta</span>
              <b>{weights(m.totals.costPerReply)}</b>
              <small>{integer(m.totals.replied)} respondieron</small>
            </div>
            <div className="kpi">
              <span>Calidad promedio</span>
              <b>{m.totals.qualityIndex ?? "—"}</b>
              <small>
                {integer(m.totals.qualified)} calificados · {integer(m.totals.high)} de calidad alta
              </small>
            </div>
          </div>

          {m.totals.totalCost === 0 && (
            <Notice type="info" className="notice-compact" title="No hay costos registrados en este periodo.">
              Sin costos el CPL sale en $0. {isAdmin ? "Regístralos abajo, en “Costos del periodo”." : "Pídele a un administrador que los registre."}
            </Notice>
          )}
          {m.totals.unassignedCost > 0 && (
            <Notice type="info" className="notice-compact" title={`${weights(m.totals.unassignedCost)} no se pudieron repartir entre las fuentes.`}>
              Son costos de canales que no contactaron a nadie en el periodo (o costos generales sin leads nuevos). Cuentan en el costo total, pero
              no en el CPL de ninguna fuente.
            </Notice>
          )}

          <div className="metrics-view">
            <div className="tabs" role="tablist" aria-label="Comparar por">
              <button type="button" role="tab" aria-selected={view === "source"} className={cn("tab", view === "source" && "active")} onClick={() => change({ view: null })}>
                Por fuente
              </button>
              <button type="button" role="tab" aria-selected={view === "channel"} className={cn("tab", view === "channel" && "active")} onClick={() => change({ view: "channel" })}>
                Por canal de contacto
              </button>
            </div>
          </div>

          <div className="panel-chart">
            <h2>Costo contra calidad</h2>
            <CostQualityChart
              points={points}
              costLabel={view === "source" ? "Costo por lead" : "Costo por lead contactado"}
              group={view === "source" ? "sources" : "channels"}
            />
          </div>

          {view === "source" ? <SourcesTable rows={m.bySource} /> : <ChannelsTable rows={m.byChannel} />}

          <details className="how-it-is-calculated">
            <summary>¿Cómo se calcula?</summary>
            <ul>
              <li>
                <b>Leads nuevos</b>: los que se encontraron en el periodo, atribuidos a la primera fuente que los trajo.
              </li>
              <li>
                <b>Costo de una fuente</b> = lo cargado a esa fuente + los costos “General” repartidos según cuántos leads trajo cada fuente + el
                costo de cada canal de contacto repartido según cuántos de sus leads se contactaron por ese canal.
              </li>
              <li>
                <b>CPL</b> = costo de la fuente / sus leads nuevos. Por canal, el costo del canal se divide entre los leads que contactó.
              </li>
              <li>
                <b>Calidad</b> (0–100): el puntaje de la calificación de Dapta o manual; sin puntaje, alta = 85, media = 60, baja = 30, descartado
                = 0. “% alta” es la parte de los calificados con calidad alta.
              </li>
              <li>Un costo que cubre más días que el periodo se cuenta en proporción a los días que caen dentro.</li>
            </ul>
          </details>
        </div>
      )}

      <Costs costs={costs.data} error={costs.error} isAdmin={isAdmin} period={{ from, to }} onChange={reload} />
    </section>
  );
}
