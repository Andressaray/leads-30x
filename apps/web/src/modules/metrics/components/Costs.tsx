// Costs of the period: the whole team sees them; only an ADMIN records or deletes them.
import { useState, type FormEvent } from "react";
import { errorMessage } from "@/shared/lib/http";
import { Notice } from "@/shared/ui";
import { shortDate, COST_CHANNEL_NAME, weights } from "../format";
import { createCost, deleteCost } from "../services/metrics.service";
import type { CostChannel, Cost } from "../types";

const GROUPS: { title: string; channels: CostChannel[] }[] = [
  { title: "Fuente (dónde se encontró el lead)", channels: ["dane", "osm", "rnt", "secop", "reps"] },
  { title: "Canal de contacto", channels: ["email", "whatsapp", "call", "dapta"] },
  { title: "Se reparte entre las fuentes", channels: ["general"] },
];

interface Props {
  costs: Cost[] | null;
  error: string | null;
  isAdmin: boolean;
  period: { from: string; to: string };
  onChange: () => void;
}

export function Costs({ costs, error, isAdmin, period, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function remove(id: number) {
    setDeleting(id);
    setActionError(null);
    try {
      await deleteCost(id);
      onChange();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="costs-section">
      <div className="section-header">
        <div>
          <h2>Costos del periodo</h2>
          <p className="sub">
            Lo que costó cada fuente y cada canal. Un costo que cubre más días que el periodo se cuenta en proporción.
            {!isAdmin && " Solo un administrador puede registrarlos."}
          </p>
        </div>
        {isAdmin && !isOpen && (
          <button type="button" className="btn-primary" onClick={() => setIsOpen(true)}>
            Registrar costo
          </button>
        )}
      </div>

      {isOpen && (
        <CostForm
          period={period}
          onCancel={() => setIsOpen(false)}
          onSaved={() => {
            setIsOpen(false);
            onChange();
          }}
        />
      )}
      {(error || actionError) && <Notice type="error" className="notice-compact" title={actionError ?? "No se pudieron cargar los costos."} details={error ? [error] : []} />}
      {costs && costs.length === 0 && (
        <p className="empty">No hay costos registrados que cubran este periodo{isAdmin ? ". Registra el primero para calcular el CPL." : "."}</p>
      )}
      {costs && costs.length > 0 && (
        <div className="table">
          <table className="metrics-table">
            <thead>
              <tr>
                <th>Cargado a</th>
                <th>Descripción</th>
                <th>Periodo</th>
                <th className="num">Monto</th>
                {isAdmin && <th aria-label="Acciones" />}
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="chip">{COST_CHANNEL_NAME[c.channel]}</span>
                  </td>
                  <td>
                    {c.description}
                    {c.type === "HOURS" && (
                      <small className="detail">
                        {c.hours} h × {weights(c.hourlyRate)}
                      </small>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {shortDate(c.from)} – {shortDate(c.to)}
                  </td>
                  <td className="num">{weights(c.amount)}</td>
                  {isAdmin && (
                    <td className="num">
                      <button type="button" className="btn-link btn-danger-text" disabled={deleting === c.id} onClick={() => remove(c.id)}>
                        {deleting === c.id ? "Borrando…" : "Borrar"}
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

function CostForm({ period, onCancel, onSaved }: { period: { from: string; to: string }; onCancel: () => void; onSaved: () => void }) {
  const [channel, setChannel] = useState<CostChannel>("general");
  const [type, setType] = useState<"EXPENSE" | "HOURS">("EXPENSE");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [hours, setHours] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totalHours = Number(hours) * Number(hourlyRate);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createCost(
        type === "EXPENSE"
          ? { channel, type, description, amount: Number(amount), from, to }
          : { channel, type, description, hours: Number(hours), hourlyRate: Number(hourlyRate), from, to },
      );
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form className="cost-form" onSubmit={save}>
      <div className="row-2">
        <label>
          Cargado a
          <select value={channel} onChange={(e) => setChannel(e.target.value as CostChannel)}>
            {GROUPS.map((g) => (
              <optgroup key={g.title} label={g.title}>
                {g.channels.map((c) => (
                  <option key={c} value={c}>
                    {COST_CHANNEL_NAME[c]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <fieldset className="segmented">
          <legend>Tipo</legend>
          <label className={type === "EXPENSE" ? "active" : undefined}>
            <input type="radio" name="type" checked={type === "EXPENSE"} onChange={() => setType("EXPENSE")} />
            Gasto
          </label>
          <label className={type === "HOURS" ? "active" : undefined}>
            <input type="radio" name="type" checked={type === "HOURS"} onChange={() => setType("HOURS")} />
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
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={type === "EXPENSE" ? "Ej. Plan de Brevo, minutos de Dapta, servidor" : "Ej. Revisión manual de leads del RNT"}
        />
      </label>
      {type === "EXPENSE" ? (
        <label>
          Monto (COP)
          <input required type="number" min="1" step="any" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
      ) : (
        <div className="row-3">
          <label>
            Horas
            <input required type="number" min="0.25" step="0.25" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
          </label>
          <label>
            Valor de la hora (COP)
            <input required type="number" min="1" step="any" inputMode="decimal" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
          </label>
          <div className="total-hours">
            <span>Total</span>
            <b>{totalHours > 0 ? weights(totalHours) : "—"}</b>
          </div>
        </div>
      )}
      <div className="row-2">
        <label>
          Desde
          <input required type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Hasta
          <input required type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {error && <Notice type="error" className="notice-compact" title={error} />}
      <div className="editor-buttons">
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn-primary" disabled={saving}>
          {saving ? "Guardando…" : "Guardar costo"}
        </button>
      </div>
    </form>
  );
}
