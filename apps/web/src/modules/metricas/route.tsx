// Punto 3 y 4: cuánto cuesta cada lead por fuente y por canal, y cuánto vale (calidad según Dapta).
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useSesion } from "@/shared/hooks/use-session";
import { mensajeDeError } from "@/shared/lib/http";
import { cn } from "@/shared/lib/cn";
import { buildMeta } from "@/shared/seo/meta";
import { Aviso, Skeleton } from "@/shared/ui";
import { Costos } from "./components/Costos";
import { GraficoCostoCalidad, type PuntoGrafico } from "./components/GraficoCostoCalidad";
import { TablaCanales, TablaFuentes } from "./components/TablasMetricas";
import { entero, NOMBRE_CANAL_COSTO, periodo as periodoRapido, pesos } from "./formato";
import { listarCostos, obtenerMetricas } from "./services/metricas.service";
import type { Costo, Metricas } from "./types";

export const meta = () => buildMeta({ title: "Métricas" });

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
type Vista = "fuente" | "canal";

export default function MetricasPage() {
  const esAdmin = useSesion()?.usuario.rol === "ADMIN";
  const [params, setParams] = useSearchParams();
  const porDefecto = periodoRapido("mes");
  const desde = FECHA.test(params.get("desde") ?? "") ? params.get("desde")! : porDefecto.desde;
  const hasta = FECHA.test(params.get("hasta") ?? "") ? params.get("hasta")! : porDefecto.hasta;
  const vista: Vista = params.get("vista") === "canal" ? "canal" : "fuente";

  const [metricas, setMetricas] = useState<{ clave: string; datos: Metricas | null; error: string | null } | null>(null);
  const [costos, setCostos] = useState<{ datos: Costo[] | null; error: string | null }>({ datos: null, error: null });
  const [version, setVersion] = useState(0);
  const clave = `${desde}|${hasta}|${version}`;

  useEffect(() => {
    const control = new AbortController();
    obtenerMetricas(desde, hasta, control.signal).then(
      (datos) => setMetricas({ clave, datos, error: null }),
      (err: unknown) => !control.signal.aborted && setMetricas({ clave, datos: null, error: mensajeDeError(err) }),
    );
    listarCostos(desde, hasta).then(
      (datos) => setCostos({ datos, error: null }),
      (err: unknown) => setCostos({ datos: null, error: mensajeDeError(err) }),
    );
    return () => control.abort();
  }, [clave, desde, hasta]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const cambiar = (c: Record<string, string | null>) =>
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

  const cargando = metricas?.clave !== clave;
  const m = metricas?.datos ?? null;
  const presets = [
    { id: "mes", etiqueta: "Este mes", ...periodoRapido("mes") },
    { id: "mes-pasado", etiqueta: "Mes pasado", ...periodoRapido("mes-pasado") },
    { id: "90", etiqueta: "Últimos 90 días", ...periodoRapido("90") },
  ];

  const puntos: PuntoGrafico[] = !m
    ? []
    : vista === "fuente"
      ? m.porFuente.map((f) => ({ id: f.fuente, nombre: NOMBRE_CANAL_COSTO[f.fuente as keyof typeof NOMBRE_CANAL_COSTO] ?? f.fuente, costo: f.costo.total > 0 ? f.cpl : null, calidad: f.indiceCalidad, leads: f.leads, calificados: f.calificados }))
      : m.porCanal.map((c) => ({ id: c.canal, nombre: NOMBRE_CANAL_COSTO[c.canal], costo: c.costo > 0 ? c.costoPorContacto : null, calidad: c.indiceCalidad, leads: c.leadsContactados, calificados: c.calificados }));

  return (
    <section>
      <header className="pagina-cabecera">
        <h1>Métricas</h1>
        <p className="sub">
          Cuánto cuesta cada lead según la fuente donde se encontró y el canal por el que se contactó, y qué tan bueno resultó según la
          calificación de Dapta.
        </p>
      </header>

      <div className="barra-periodo">
        <div className="pestanas" role="group" aria-label="Periodo">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn("pestana", desde === p.desde && hasta === p.hasta && "activa")}
              aria-pressed={desde === p.desde && hasta === p.hasta}
              onClick={() => cambiar({ desde: p.desde, hasta: p.hasta })}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
        <div className="rango-fechas">
          <label>
            Desde
            <input type="date" value={desde} max={hasta} onChange={(e) => e.target.value && cambiar({ desde: e.target.value })} />
          </label>
          <label>
            Hasta
            <input type="date" value={hasta} min={desde} onChange={(e) => e.target.value && cambiar({ hasta: e.target.value })} />
          </label>
        </div>
      </div>

      {metricas?.error && !cargando && <Aviso tipo="error" titulo="No se pudieron calcular las métricas." detalles={[metricas.error]} />}

      {cargando && !m && (
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
        <div className={cn("metricas", cargando && "recargando")}>
          <div className="kpis">
            <div className="kpi">
              <span>Leads nuevos</span>
              <b>{entero(m.totales.leads)}</b>
              <small>
                {entero(m.totales.contactados)} contactados · {entero(m.totales.respondieron)} respondieron
              </small>
            </div>
            <div className="kpi">
              <span>Costo total</span>
              <b>{pesos(m.totales.costoTotal)}</b>
              <small>{m.periodo.dias} días</small>
            </div>
            <div className="kpi kpi-principal">
              <span>Costo por lead (CPL)</span>
              <b>{pesos(m.totales.cpl)}</b>
              <small>costo total / leads nuevos</small>
            </div>
            <div className="kpi">
              <span>Costo por respuesta</span>
              <b>{pesos(m.totales.costoPorRespuesta)}</b>
              <small>{entero(m.totales.respondieron)} respondieron</small>
            </div>
            <div className="kpi">
              <span>Calidad promedio</span>
              <b>{m.totales.indiceCalidad ?? "—"}</b>
              <small>
                {entero(m.totales.calificados)} calificados · {entero(m.totales.alta)} de calidad alta
              </small>
            </div>
          </div>

          {m.totales.costoTotal === 0 && (
            <Aviso tipo="info" className="aviso-compacto" titulo="No hay costos registrados en este periodo.">
              Sin costos el CPL sale en $0. {esAdmin ? "Regístralos abajo, en “Costos del periodo”." : "Pídele a un administrador que los registre."}
            </Aviso>
          )}
          {m.totales.costoSinAsignar > 0 && (
            <Aviso tipo="info" className="aviso-compacto" titulo={`${pesos(m.totales.costoSinAsignar)} no se pudieron repartir entre las fuentes.`}>
              Son costos de canales que no contactaron a nadie en el periodo (o costos generales sin leads nuevos). Cuentan en el costo total, pero
              no en el CPL de ninguna fuente.
            </Aviso>
          )}

          <div className="vista-metricas">
            <div className="pestanas" role="tablist" aria-label="Comparar por">
              <button type="button" role="tab" aria-selected={vista === "fuente"} className={cn("pestana", vista === "fuente" && "activa")} onClick={() => cambiar({ vista: null })}>
                Por fuente
              </button>
              <button type="button" role="tab" aria-selected={vista === "canal"} className={cn("pestana", vista === "canal" && "activa")} onClick={() => cambiar({ vista: "canal" })}>
                Por canal de contacto
              </button>
            </div>
          </div>

          <div className="panel-grafico">
            <h2>Costo contra calidad</h2>
            <GraficoCostoCalidad
              puntos={puntos}
              etiquetaCosto={vista === "fuente" ? "Costo por lead" : "Costo por lead contactado"}
              grupo={vista === "fuente" ? "fuentes" : "canales"}
            />
          </div>

          {vista === "fuente" ? <TablaFuentes filas={m.porFuente} /> : <TablaCanales filas={m.porCanal} />}

          <details className="como-se-calcula">
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

      <Costos costos={costos.datos} error={costos.error} esAdmin={esAdmin} periodo={{ desde, hasta }} onCambio={recargar} />
    </section>
  );
}
