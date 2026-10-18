// Sends to Dapta, at once, the leads of the page that can be qualified.
import { useEffect, useState } from "react";
import { sendBatchToDapta, daptaStatus, type DaptaStatus, type DaptaBatchResult } from "@/modules/contact";
import { errorMessage } from "@/shared/lib/http";
import { Notice } from "@/shared/ui";
import type { Lead } from "../types";

export function DaptaDispatch({ leads, onSent }: { leads: Lead[]; onSent: () => void }) {
  const [dapta, setDapta] = useState<DaptaStatus | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<(DaptaBatchResult & { names: Map<number, string> }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    daptaStatus().then(setDapta, () => setDapta(null));
  }, []);

  // Already qualified ones, or ones that asked not to be contacted, are not sent.
  const candidates = leads.filter((l) => !l.doNotContact && !l.quality);
  if (!dapta || dapta.mode === "disabled") return null;

  async function send() {
    setSending(true);
    setError(null);
    try {
      const r = await sendBatchToDapta(candidates.map((l) => l.id));
      setResult({ ...r, names: new Map(leads.map((l) => [l.id, l.name])) });
      setConfirming(false);
      if (r.sent) onSent();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const skipped = result?.results.filter((r) => !r.ok) ?? [];
  return (
    <div className="dapta-dispatch">
      {!confirming ? (
        <div className="dapta-dispatch-bar">
          <span>
            {candidates.length
              ? `${candidates.length} lead${candidates.length === 1 ? "" : "s"} de esta página sin calificar.`
              : "Todos los leads de esta página ya están calificados."}
            {dapta.mode === "simulated" && " Dapta está en modo simulado: no saldrán."}
          </span>
          <button type="button" className="btn-secondary" disabled={!candidates.length} onClick={() => setConfirming(true)}>
            Enviar a Dapta
          </button>
        </div>
      ) : (
        <div className="dapta-dispatch-bar confirm">
          <span>
            ¿Mandar {candidates.length} lead{candidates.length === 1 ? "" : "s"} a Dapta?
            {dapta.contacts && " El agente los llamará: se aplican las reglas de contacto y los que no se puedan llamar hoy se omiten."}
          </span>
          <div className="confirm-buttons">
            <button type="button" onClick={() => setConfirming(false)} disabled={sending}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={send} disabled={sending}>
              {sending ? "Enviando…" : "Sí, enviar"}
            </button>
          </div>
        </div>
      )}
      {error && <Notice type="error" className="notice-compact" title={error} />}
      {result && (
        <Notice
          type={result.sent ? "info" : "error"}
          className="notice-compact"
          title={`${result.sent} enviado${result.sent === 1 ? "" : "s"} a Dapta${skipped.length ? `, ${skipped.length} omitido${skipped.length === 1 ? "" : "s"}` : ""}.`}
          details={skipped.map((o) => `${result.names.get(o.leadId) ?? `Lead ${o.leadId}`}: ${o.reason}`)}
        />
      )}
    </div>
  );
}
