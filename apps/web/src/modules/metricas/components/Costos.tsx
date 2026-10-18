// Costos del periodo: los ve todo el equipo; solo un ADMIN los registra o borra.
import { useState, type FormEvent } from "react";
import { mensajeDeError } from "@/shared/lib/http";
import { Aviso } from "@/shared/ui";
import { fechaCorta, NOMBRE_CANAL_COSTO, pesos } from "../formato";
import { crearCosto, eliminarCosto } from "../services/metricas.service";
import type { CanalCosto, Costo } from "../types";

const GRUPOS: { titulo: string; canales: CanalCosto[] }[] = [
  { titulo: "Fuente (dónde se encontró el lead)", canales: ["dane", "osm", "rnt", "secop", "reps"] },
  { titulo: "Canal de contacto", canales: ["email", "whatsapp", "llamada", "dapta"] },
  { titulo: "Se reparte entre las fuentes", canales: ["general"] },
];

interface Props {
  costos: Costo[] | null;
  error: string | null;
  esAdmin: boolean;
  periodo: { desde: string; hasta: string };
  onCambio: () => void;
}

export function Costos({ costos, error, esAdmin, periodo, onCambio }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [borrando, setBorrando] = useState<number | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  async function borrar(id: number) {
    setBorrando(id);
    setErrorAccion(null);
    try {
      await eliminarCosto(id);
      onCambio();
    } catch (err) {
      setErrorAccion(mensajeDeError(err));
    } finally {
      setBorrando(null);
    }
  }

  return (
    <section className="seccion-costos">
      <div className="seccion-cabecera">
        <div>
          <h2>Costos del periodo</h2>
          <p className="sub">
            Lo que costó cada fuente y cada canal. Un costo que cubre más días que el periodo se cuenta en proporción.
            {!esAdmin && " Solo un administrador puede registrarlos."}
          </p>
        </div>
        {esAdmin && !abierto && (
          <button type="button" className="btn-primario" onClick={() => setAbierto(true)}>
            Registrar costo
          </button>
        )}
      </div>

      {abierto && (
        <FormCosto
          periodo={periodo}
          onCancelar={() => setAbierto(false)}
          onGuardado={() => {
            setAbierto(false);
            onCambio();
          }}
        />
      )}
      {(error || errorAccion) && <Aviso tipo="error" className="aviso-compacto" titulo={errorAccion ?? "No se pudieron cargar los costos."} detalles={error ? [error] : []} />}
      {costos && costos.length === 0 && (
        <p className="vacio">No hay costos registrados que cubran este periodo{esAdmin ? ". Registra el primero para calcular el CPL." : "."}</p>
      )}
      {costos && costos.length > 0 && (
        <div className="tabla">
          <table className="tabla-metricas">
            <thead>
              <tr>
                <th>Cargado a</th>
                <th>Descripción</th>
                <th>Periodo</th>
                <th className="num">Monto</th>
                {esAdmin && <th aria-label="Acciones" />}
              </tr>
            </thead>
            <tbody>
              {costos.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="chip">{NOMBRE_CANAL_COSTO[c.canal]}</span>
                  </td>
                  <td>
                    {c.descripcion}
                    {c.tipo === "HORAS" && (
                      <small className="detalle">
                        {c.horas} h × {pesos(c.valorHora)}
                      </small>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {fechaCorta(c.desde)} – {fechaCorta(c.hasta)}
                  </td>
                  <td className="num">{pesos(c.monto)}</td>
                  {esAdmin && (
                    <td className="num">
                      <button type="button" className="btn-enlace btn-peligro-texto" disabled={borrando === c.id} onClick={() => borrar(c.id)}>
                        {borrando === c.id ? "Borrando…" : "Borrar"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FormCosto({ periodo, onCancelar, onGuardado }: { periodo: { desde: string; hasta: string }; onCancelar: () => void; onGuardado: () => void }) {
  const [canal, setCanal] = useState<CanalCosto>("general");
  const [tipo, setTipo] = useState<"GASTO" | "HORAS">("GASTO");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [horas, setHoras] = useState("");
  const [valorHora, setValorHora] = useState("");
  const [desde, setDesde] = useState(periodo.desde);
  const [hasta, setHasta] = useState(periodo.hasta);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totalHoras = Number(horas) * Number(valorHora);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await crearCosto(
        tipo === "GASTO"
          ? { canal, tipo, descripcion, monto: Number(monto), desde, hasta }
          : { canal, tipo, descripcion, horas: Number(horas), valorHora: Number(valorHora), desde, hasta },
      );
      onGuardado();
    } catch (err) {
      setError(mensajeDeError(err));
      setGuardando(false);
    }
  }

  return (
    <form className="form-costo" onSubmit={guardar}>
      <div className="fila-2">
        <label>
          Cargado a
          <select value={canal} onChange={(e) => setCanal(e.target.value as CanalCosto)}>
            {GRUPOS.map((g) => (
              <optgroup key={g.titulo} label={g.titulo}>
                {g.canales.map((c) => (
                  <option key={c} value={c}>
                    {NOMBRE_CANAL_COSTO[c]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <fieldset className="segmentado">
          <legend>Tipo</legend>
          <label className={tipo === "GASTO" ? "activo" : undefined}>
            <input type="radio" name="tipo" checked={tipo === "GASTO"} onChange={() => setTipo("GASTO")} />
            Gasto
          </label>
          <label className={tipo === "HORAS" ? "activo" : undefined}>
            <input type="radio" name="tipo" checked={tipo === "HORAS"} onChange={() => setTipo("HORAS")} />
            Horas del equipo
          </label>
        </fieldset>
      </div>
      <label>
        Descripción
        <input
          required
          minLength={2}
          maxLength={200}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder={tipo === "GASTO" ? "Ej. Plan de Brevo, minutos de Dapta, servidor" : "Ej. Revisión manual de leads del RNT"}
        />
      </label>
      {tipo === "GASTO" ? (
        <label>
          Monto (COP)
          <input required type="number" min="1" step="any" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </label>
      ) : (
        <div className="fila-3">
          <label>
            Horas
            <input required type="number" min="0.25" step="0.25" inputMode="decimal" value={horas} onChange={(e) => setHoras(e.target.value)} />
          </label>
          <label>
            Valor de la hora (COP)
            <input required type="number" min="1" step="any" inputMode="decimal" value={valorHora} onChange={(e) => setValorHora(e.target.value)} />
          </label>
          <div className="total-horas">
            <span>Total</span>
            <b>{totalHoras > 0 ? pesos(totalHoras) : "—"}</b>
          </div>
        </div>
      )}
      <div className="fila-2">
        <label>
          Desde
          <input required type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          Hasta
          <input required type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
        </label>
      </div>
      {error && <Aviso tipo="error" className="aviso-compacto" titulo={error} />}
      <div className="editor-botones">
        <button type="button" onClick={onCancelar}>
          Cancelar
        </button>
        <button className="btn-primario" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar costo"}
        </button>
      </div>
    </form>
  );
}
