import { StatusChip } from "./StatusChip";
import { dateTime, CHANNEL_NAME } from "../statuses";
import type { Interaction } from "../types";

function title(i: Interaction): string {
  if (i.direction === "INBOUND") {
    if (!i.result) return "Pidió no ser contactado";
    return i.channel === "DAPTA" ? "Habló con el agente de Dapta" : `Respuesta por ${CHANNEL_NAME[i.channel].toLowerCase()}`;
  }
  if (i.channel === "EMAIL") return i.status === "FAILED" ? "Correo que no salió" : "Correo enviado";
  if (i.channel === "WHATSAPP") return "WhatsApp";
  if (i.channel === "CALL") return "Llamada";
  if (i.channel === "DAPTA") return "Llamada del agente de Dapta";
  return "Contacto por otro canal";
}

export function History({ interactions }: { interactions: Interaction[] }) {
  if (!interactions.length) return <p className="history-empty">Todavía no hay mensajes ni llamadas con este lead.</p>;
  return (
    <ol className="history">
      {interactions.map((i) => (
        <li key={i.id} className={`history-item history-${i.direction.toLowerCase()}${i.status === "FAILED" ? " history-failed" : ""}`}>
          <div className="history-line">
            <b>{title(i)}</b>
            {i.result && <StatusChip status={i.result} />}
            {i.status === "SIMULATED" && <span className="chip" title="Sin SMTP configurado: no salió">Simulado</span>}
            {i.status === "FAILED" && <span className="chip chip-error">Falló</span>}
          </div>
          <div className="history-meta">
            {dateTime(i.createdAt)}
            {i.user && ` · ${i.user.fullName}`}
            {i.destination && ` · ${i.destination}`}
          </div>
          {i.subject && <div className="history-subject">{i.subject}</div>}
          {i.message && (
            <details className="history-message">
              <summary>Ver mensaje</summary>
              <p>{i.message}</p>
            </details>
          )}
          {i.note && <p className="history-note">{i.note}</p>}
          {i.error && <p className="history-error">{i.error}</p>}
        </li>
      ))}
    </ol>
  );
}
