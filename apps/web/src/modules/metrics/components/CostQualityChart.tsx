// Cost vs. quality: each point is a source or a channel. To the left = cheaper; up = better quality.
// A single series (chart color), each point labeled with its name: no legend needed.
import { useEffect, useRef, useState } from "react";
import { integer, weights } from "../format";

export interface ChartPoint {
  id: string;
  name: string;
  /** Cost per lead (or per contacted lead). */
  cost: number | null;
  /** 0–100 quality index. */
  quality: number | null;
  leads: number;
  qualified: number;
}

interface Props {
  points: ChartPoint[];
  costLabel: string;
  /** Group name in plural, for the "no data" text ("fuentes", "canales"). */
  group: string;
}

const HEIGHT = 300;
const M = { above: 16, right: 24, below: 40, left: 44 };
const COMPACT = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", notation: "compact", maximumFractionDigits: 1 });

/** "Round" axis maximum (1, 2, 2.5 or 5 × 10^n) and its ticks. */
function scale(max: number): number[] {
  if (max <= 0) return [0, 1];
  const step0 = max / 4;
  const p = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= step0)!;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.999; v += step) ticks.push(v);
  return ticks;
}

export function CostQualityChart({ points, costLabel, group }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const withData = points.filter((p) => p.cost !== null && p.quality !== null) as (ChartPoint & { cost: number; quality: number })[];
  const noData = points.filter((p) => p.cost === null || p.quality === null);
  const ticksX = scale(Math.max(...withData.map((p) => p.cost), 0) * 1.08);
  const maxX = ticksX.at(-1)!;
  const ticksY = [0, 25, 50, 75, 100];
  const iw = width - M.left - M.right;
  const ih = HEIGHT - M.above - M.below;
  const x = (v: number) => M.left + (v / maxX) * iw;
  const y = (v: number) => M.above + ih - (v / 100) * ih;

  // Labels: to the right of the point, or to the left if they do not fit; they are separated if they collide.
  const labels = withData
    .map((p) => {
      const long = p.name.length * 7 + 6;
      const right = x(p.cost) + 10 + long <= width - 4;
      return { id: p.id, text: p.name, lx: right ? x(p.cost) + 10 : x(p.cost) - 10, ly: y(p.quality) + 4, anchor: right ? "start" : "end", long };
    })
    .sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < labels.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = labels[j];
      const b = labels[i];
      const crossX = Math.abs((a.anchor === "start" ? a.lx : a.lx - a.long) - (b.anchor === "start" ? b.lx : b.lx - b.long)) < Math.max(a.long, b.long);
      if (crossX && b.ly - a.ly < 15) b.ly = a.ly + 15;
    }
  }

  const point = withData.find((p) => p.id === active);

  return (
    <figure className="chart">
      <div ref={box} className="chart-canvas">
        {withData.length === 0 ? (
          <p className="chart-empty">
            Todavía no hay {group} con costo y calificación en este periodo. Registra los costos y califica leads (con Dapta o a mano) para comparar.
          </p>
        ) : (
          <svg width={width} height={HEIGHT} role="img" aria-label={`Costo contra calidad por ${group}`}>
            {ticksY.map((v) => (
              <g key={`y${v}`}>
                <line className="chart-grid" x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} />
                <text className="chart-axis" x={M.left - 8} y={y(v) + 4} textAnchor="end">
                  {v}
                </text>
              </g>
            ))}
            {ticksX.map((v) => (
              <text key={`x${v}`} className="chart-axis" x={x(v)} y={HEIGHT - M.below + 18} textAnchor="middle">
                {v === 0 ? "$0" : COMPACT.format(v)}
              </text>
            ))}
            <text className="chart-axis-title" x={M.left + iw / 2} y={HEIGHT - 4} textAnchor="middle">
              {costLabel} →
            </text>
            <text className="chart-axis-title" transform={`translate(12 ${M.above + ih / 2}) rotate(-90)`} textAnchor="middle">
              Calidad (0–100) →
            </text>
            {withData.map((p) => (
              <g
                key={p.id}
                className="chart-point"
                tabIndex={0}
                role="button"
                aria-label={`${p.name}: ${costLabel.toLowerCase()} ${weights(p.cost)}, calidad ${p.quality}`}
                onMouseEnter={() => setActive(p.id)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(p.id)}
                onBlur={() => setActive(null)}
              >
                <circle className="chart-target" cx={x(p.cost)} cy={y(p.quality)} r={14} />
                <circle className="chart-tick" cx={x(p.cost)} cy={y(p.quality)} r={active === p.id ? 7 : 5.5} />
              </g>
            ))}
            {labels.map((r) => (
              <text key={r.id} className="chart-label" x={r.lx} y={r.ly} textAnchor={r.anchor as "start" | "end"}>
                {r.text}
              </text>
            ))}
          </svg>
        )}
        {point && (
          <div
            className="chart-tooltip"
            style={{
              left: Math.min(Math.max(x(point.cost), 90), width - 90),
              top: y(point.quality) > 110 ? y(point.quality) - 12 : y(point.quality) + 22,
              transform: y(point.quality) > 110 ? "translate(-50%, -100%)" : "translate(-50%, 0)",
            }}
            role="status"
          >
            <b>{point.name}</b>
            <span>
              {costLabel}: <b>{weights(point.cost)}</b>
            </span>
            <span>
              Calidad: <b>{point.quality}</b> de 100
            </span>
            <span>
              {integer(point.qualified)} calificado{point.qualified === 1 ? "" : "s"} de {integer(point.leads)} lead{point.leads === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>
      <figcaption>
        Mejor arriba a la izquierda: más barato y de mejor calidad.
        {noData.length > 0 && withData.length > 0 && <> Sin datos para comparar: {noData.map((p) => p.name).join(", ")}.</>}
      </figcaption>
    </figure>
  );
}
