// Lead qualification (point 4): send it to Dapta, see what came back or qualify it manually.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { errorMessage } from "@/shared/lib/http";
import { cn } from "@/shared/lib/cn";
import { Notice } from "@/shared/ui";
import { dateTime, QUALITY_NAME } from "../statuses";
import { qualifyManually, sendToDapta, daptaStatus, listQualifications } from "../services/contact.service";
import type { LeadQuality, Qualification, DaptaStatus, ContactSheet } from "../types";
import { QualityChip } from "./QualityChip";

const SEND_STATUS: Record<Qualification["status"], string> = {
  SENT: "Esperando a Dapta",
  SIMULATED: "Simulado (no salió)",
  FAILED: "No se pudo enviar",
  QUALIFIED: "Calificado",
  NO_CONTACT: "Dapta no logró hablar con el lead",
};

interface Props {
  sheet: ContactSheet;
  /** Whether they cannot work this lead (it belongs to someone else). */
  readOnly: boolean;
  onDone: (message: string) => void;
}

export function QualificationSection({ sheet, readOnly, onDone }: Props) {
  const { lead, permission } = sheet;
  const [dapta, setDapta] = useState<DaptaStatus | null>(null);
  const [history, setHistory] = useState<Qualification[] | null>(null);
  const [sending, setSending] = useState(false);
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listQualifications(lead.id).then(setHistory, (err: unknown) => setError(errorMessage(err)));
  }, [lead.id]);
  useEffect(() => {
    daptaStatus().then(setDapta, () => setDapta(null));
    load();
  }, [load]);

  const pending = history?.find((c) => c.origin === "DAPTA" && (c.status === "SENT" || c.status === "SIMULATED"));
  // If the Dapta agent calls, it is a call: same rules as the other channels.
  const block = lead.doNotContact
    ? "Pidió no volver a ser contactado."
    : dapta?.contacts
      ? (permission.reason ?? permission.byChannel.CALL)
      : null;

  async function send() {
    setSending(true);
    setError(null);
    try {
      const c = await sendToDapta(lead.id);
      load();
      onDone(c.status === "SIMULATED" ? "Enviado a Dapta en modo simulado (no salió: falta DAPTA_FLOW_URL)." : "Enviado a Dapta. La calificación llega cuando termine el flujo.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="qualification">
      <div className="qualification-current">
        {lead.quality ? (
          <>
            <QualityChip quality={lead.quality} score={lead.score} />
            {lead.qualifiedAt && <span>Calificado el {new Date(lead.qualifiedAt).toLocaleDateString("es-CO")}</span>}
          </>
        ) : (
          <span className="muted">Sin calificar todavía.</span>
        )}
      </div>

      {dapta?.mode === "simulated" && (
        <Notice type="info" className="notice-compact" title="Dapta en modo simulado">
          Falta DAPTA_FLOW_URL en la API: los envíos se registran pero no salen. Puedes calificar a mano.
        </Notice>
      )}
      {dapta?.mode === "disabled" && <Notice type="error" className="notice-compact" title="La integración con Dapta no está configurada en el servidor." />}
      {pending && <p className="help">Enviado a Dapta el {dateTime(pending.createdAt)}: esperando la calificación.</p>}
      {!readOnly && block && !pending && <Notice type="info" className="notice-compact" title={`Dapta llama al lead: ${block}`} />}
      {error && <Notice type="error" className="notice-compact" title={error} />}

      {!readOnly && (
        <div className="qualification-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={sending || Boolean(pending) || Boolean(block) || dapta?.mode === "disabled"}
            title={pending ? "Ya está en Dapta esperando la calificación" : (block ?? undefined)}
            onClick={send}
          >
            {sending ? "Enviando…" : "Enviar a Dapta"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setManual((v) => !v)} aria-expanded={manual}>
            Calificar a mano
          </button>
        </div>
      )}
      {manual && (
        <ManualForm
          leadId={lead.id}
          onDone={(m) => {
            setManual(false);
            load();
            onDone(m);
          }}
        />
      )}

      {history && history.length > 0 && (
        <ol className="history history-qualifications">
          {history.map((c) => (
            <li key={c.id} className={cn("history-item", c.status === "QUALIFIED" ? "history-inbound" : c.status === "FAILED" && "history-failed")}>
              <div className="history-line">
                <b>{c.origin === "DAPTA" ? "Dapta" : "Calificación manual"}</b>
                {c.quality ? <QualityChip quality={c.quality} score={c.score} /> : <span className="chip">{SEND_STATUS[c.status]}</span>}
              </div>
              <div className="history-meta">
                {dateTime(c.qualifiedAt ?? c.createdAt)}
                {c.user && ` · ${c.origin === "DAPTA" ? "enviado por " : ""}${c.user.fullName}`}
              </div>
              {c.summary && <p className="history-note">{c.summary}</p>}
              {c.error && <p className="history-error">{c.error}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const QUALITIES: LeadQuality[] = ["HIGH", "MEDIUM", "LOW", "DISCARDED"];

function ManualForm({ leadId, onDone }: { leadId: number; onDone: (m: string) => void }) {
  const [quality, setQuality] = useState<LeadQuality | null>(null);
  const [score, setScore] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!quality) return setError("Elige la calidad.");
    setSaving(true);
    setError(null);
    try {
      await qualifyManually(leadId, { quality, score: score === "" ? undefined : Number(score), note: note || undefined });
      onDone(`Calificado a mano: ${QUALITY_NAME[quality].toLowerCase()}.`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form className="contact-form form-manual" onSubmit={save}>
      <fieldset className="segmented">
        <legend>Calidad</legend>
        {QUALITIES.map((c) => (
          <label key={c} className={quality === c ? "active" : undefined}>
            <input type="radio" name="quality" checked={quality === c} onChange={() => setQuality(c)} />
            {QUALITY_NAME[c].replace("Calidad ", "")}
          </label>
        ))}
      </fieldset>
      <div className="row-2">
        <label>
          Puntaje (opcional)
          <input type="number" min={0} max={100} inputMode="numeric" placeholder="0 a 100" value={score} onChange={(e) => setScore(e.target.value)} />
        </label>
        <label>
          Nota
          <input maxLength={1000} placeholder="Por qué" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      {error && <Notice type="error" className="notice-compact" title={error} />}
      <button className="btn-secondary" disabled={saving}>
        {saving ? "Guardando…" : "Guardar calificación"}
      </button>
    </form>
  );
}
