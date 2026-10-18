import { entero, NOMBRE_CANAL_COSTO, pct, pesos } from "../formato";
import type { MetricaCanal, MetricaFuente } from "../types";

function Calidad({ indice, tasaAlta, calificados }: { indice: number | null; tasaAlta: number | null; calificados: number }) {
  if (indice === null) return <span className="tenue">Sin calificar</span>;
  return (
    <span className="celda-calidad">
      <span className="barra-calidad" aria-hidden="true">
        <span style={{ width: `${indice}%` }} />
      </span>
      <b>{indice}</b>
      <small>
        {pct(tasaAlta)} alta · {entero(calificados)}
      </small>
    </span>
  );
}

/** "4 de 10 (40 %)" */
const deTotal = (n: number, total: number) => (total ? `${entero(n)} (${pct(n / total)})` : entero(n));

export function TablaFuentes({ filas }: { filas: MetricaFuente[] }) {
  return (
    <div className="tabla">
      <table className="tabla-metricas">
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
          {filas.map((f) => (
            <tr key={f.fuente} className={f.leads === 0 && f.costo.total === 0 ? "fila-vacia" : undefined}>
              <td>
                <b>{NOMBRE_CANAL_COSTO[f.fuente as keyof typeof NOMBRE_CANAL_COSTO] ?? f.fuente}</b>
              </td>
              <td className="num">{entero(f.leads)}</td>
              <td className="num">{deTotal(f.contactados, f.leads)}</td>
              <td className="num">{deTotal(f.respondieron, f.contactados)}</td>
              <td>
                <Calidad indice={f.indiceCalidad} tasaAlta={f.tasaAlta} calificados={f.calificados} />
              </td>
              <td className="num" title={`Directo ${pesos(f.costo.directo)} · general ${pesos(f.costo.general)} · contacto ${pesos(f.costo.contacto)}`}>
                {pesos(f.costo.total)}
              </td>
              <td className="num">
                <b>{pesos(f.cpl)}</b>
              </td>
              <td className="num">{pesos(f.costoPorRespuesta)}</td>
              <td className="num">{pesos(f.costoPorLeadAlta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TablaCanales({ filas }: { filas: MetricaCanal[] }) {
  return (
    <div className="tabla">
      <table className="tabla-metricas">
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
          {filas.map((c) => (
            <tr key={c.canal} className={c.contactos === 0 && c.costo === 0 ? "fila-vacia" : undefined}>
              <td>
                <b>{NOMBRE_CANAL_COSTO[c.canal]}</b>
              </td>
              <td className="num">{entero(c.contactos)}</td>
              <td className="num">{entero(c.leadsContactados)}</td>
              <td className="num">{deTotal(c.respondieron, c.leadsContactados)}</td>
              <td>
                <Calidad indice={c.indiceCalidad} tasaAlta={c.tasaAlta} calificados={c.calificados} />
              </td>
              <td className="num">{pesos(c.costo)}</td>
              <td className="num">
                <b>{pesos(c.costoPorContacto)}</b>
              </td>
              <td className="num">{pesos(c.costoPorRespuesta)}</td>
              <td className="num">{pesos(c.costoPorLeadAlta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
