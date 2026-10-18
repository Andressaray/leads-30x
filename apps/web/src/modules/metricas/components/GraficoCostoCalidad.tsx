// Costo vs. calidad: cada punto es una fuente o un canal. A la izquierda = más barato; arriba = mejor calidad.
// Una sola serie (color de gráfico), cada punto rotulado con su nombre: no necesita leyenda.
import { useEffect, useRef, useState } from "react";
import { entero, pesos } from "../formato";

export interface PuntoGrafico {
  id: string;
  nombre: string;
  /** Costo por lead (o por lead contactado). */
  costo: number | null;
  /** Índice de calidad 0–100. */
  calidad: number | null;
  leads: number;
  calificados: number;
}

interface Props {
  puntos: PuntoGrafico[];
  etiquetaCosto: string;
  /** Nombre del grupo en plural, para el texto de "sin datos" ("fuentes", "canales"). */
  grupo: string;
}

const ALTO = 300;
const M = { arriba: 16, derecha: 24, abajo: 40, izquierda: 44 };
const COMPACTO = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", notation: "compact", maximumFractionDigits: 1 });

/** Máximo "redondo" del eje (1, 2, 2.5 o 5 × 10^n) y sus marcas. */
function escala(max: number): number[] {
  if (max <= 0) return [0, 1];
  const paso0 = max / 4;
  const p = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= paso0)!;
  const marcas: number[] = [];
  for (let v = 0; v <= max + paso * 0.999; v += paso) marcas.push(v);
  return marcas;
}

export function GraficoCostoCalidad({ puntos, etiquetaCosto, grupo }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(640);
  const [activo, setActivo] = useState<string | null>(null);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setAncho(Math.max(280, Math.round(e.contentRect.width))));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const conDatos = puntos.filter((p) => p.costo !== null && p.calidad !== null) as (PuntoGrafico & { costo: number; calidad: number })[];
  const sinDatos = puntos.filter((p) => p.costo === null || p.calidad === null);
  const marcasX = escala(Math.max(...conDatos.map((p) => p.costo), 0) * 1.08);
  const maxX = marcasX.at(-1)!;
  const marcasY = [0, 25, 50, 75, 100];
  const iw = ancho - M.izquierda - M.derecha;
  const ih = ALTO - M.arriba - M.abajo;
  const x = (v: number) => M.izquierda + (v / maxX) * iw;
  const y = (v: number) => M.arriba + ih - (v / 100) * ih;

  // Rótulos: a la derecha del punto, o a la izquierda si no caben; se separan si chocan.
  const rotulos = conDatos
    .map((p) => {
      const largo = p.nombre.length * 7 + 6;
      const derecha = x(p.costo) + 10 + largo <= ancho - 4;
      return { id: p.id, texto: p.nombre, lx: derecha ? x(p.costo) + 10 : x(p.costo) - 10, ly: y(p.calidad) + 4, ancla: derecha ? "start" : "end", largo };
    })
    .sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < rotulos.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = rotulos[j];
      const b = rotulos[i];
      const cruzanX = Math.abs((a.ancla === "start" ? a.lx : a.lx - a.largo) - (b.ancla === "start" ? b.lx : b.lx - b.largo)) < Math.max(a.largo, b.largo);
      if (cruzanX && b.ly - a.ly < 15) b.ly = a.ly + 15;
    }
  }

  const punto = conDatos.find((p) => p.id === activo);

  return (
    <figure className="grafico">
      <div ref={caja} className="grafico-lienzo">
        {conDatos.length === 0 ? (
          <p className="grafico-vacio">
            Todavía no hay {grupo} con costo y calificación en este periodo. Registra los costos y califica leads (con Dapta o a mano) para comparar.
          </p>
        ) : (
          <svg width={ancho} height={ALTO} role="img" aria-label={`Costo contra calidad por ${grupo}`}>
            {marcasY.map((v) => (
              <g key={`y${v}`}>
                <line className="grafico-rejilla" x1={M.izquierda} x2={ancho - M.derecha} y1={y(v)} y2={y(v)} />
                <text className="grafico-eje" x={M.izquierda - 8} y={y(v) + 4} textAnchor="end">
                  {v}
                </text>
              </g>
            ))}
            {marcasX.map((v) => (
              <text key={`x${v}`} className="grafico-eje" x={x(v)} y={ALTO - M.abajo + 18} textAnchor="middle">
                {v === 0 ? "$0" : COMPACTO.format(v)}
              </text>
            ))}
            <text className="grafico-titulo-eje" x={M.izquierda + iw / 2} y={ALTO - 4} textAnchor="middle">
              {etiquetaCosto} →
            </text>
            <text className="grafico-titulo-eje" transform={`translate(12 ${M.arriba + ih / 2}) rotate(-90)`} textAnchor="middle">
              Calidad (0–100) →
            </text>
            {conDatos.map((p) => (
              <g
                key={p.id}
                className="grafico-punto"
                tabIndex={0}
                role="button"
                aria-label={`${p.nombre}: ${etiquetaCosto.toLowerCase()} ${pesos(p.costo)}, calidad ${p.calidad}`}
                onMouseEnter={() => setActivo(p.id)}
                onMouseLeave={() => setActivo(null)}
                onFocus={() => setActivo(p.id)}
                onBlur={() => setActivo(null)}
              >
                <circle className="grafico-objetivo" cx={x(p.costo)} cy={y(p.calidad)} r={14} />
                <circle className="grafico-marca" cx={x(p.costo)} cy={y(p.calidad)} r={activo === p.id ? 7 : 5.5} />
              </g>
            ))}
            {rotulos.map((r) => (
              <text key={r.id} className="grafico-rotulo" x={r.lx} y={r.ly} textAnchor={r.ancla as "start" | "end"}>
                {r.texto}
              </text>
            ))}
          </svg>
        )}
        {punto && (
          <div
            className="grafico-tooltip"
            style={{
              left: Math.min(Math.max(x(punto.costo), 90), ancho - 90),
              top: y(punto.calidad) > 110 ? y(punto.calidad) - 12 : y(punto.calidad) + 22,
              transform: y(punto.calidad) > 110 ? "translate(-50%, -100%)" : "translate(-50%, 0)",
            }}
            role="status"
          >
            <b>{punto.nombre}</b>
            <span>
              {etiquetaCosto}: <b>{pesos(punto.costo)}</b>
            </span>
            <span>
              Calidad: <b>{punto.calidad}</b> de 100
            </span>
            <span>
              {entero(punto.calificados)} calificado{punto.calificados === 1 ? "" : "s"} de {entero(punto.leads)} lead{punto.leads === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>
      <figcaption>
        Mejor arriba a la izquierda: más barato y de mejor calidad.
        {sinDatos.length > 0 && conDatos.length > 0 && <> Sin datos para comparar: {sinDatos.map((p) => p.nombre).join(", ")}.</>}
      </figcaption>
    </figure>
  );
}
