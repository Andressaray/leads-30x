import { EstadoChip } from "./EstadoChip";
import { fechaHora, NOMBRE_CANAL } from "../estados";
import type { Interaccion } from "../types";

function titulo(i: Interaccion): string {
  if (i.sentido === "ENTRANTE") {
    if (!i.resultado) return "Pidió no ser contactado";
    return i.canal === "DAPTA" ? "Habló con el agente de Dapta" : `Respuesta por ${NOMBRE_CANAL[i.canal].toLowerCase()}`;
  }
  if (i.canal === "EMAIL") return i.estado === "FALLIDO" ? "Correo que no salió" : "Correo enviado";
  if (i.canal === "WHATSAPP") return "WhatsApp";
  if (i.canal === "LLAMADA") return "Llamada";
  if (i.canal === "DAPTA") return "Llamada del agente de Dapta";
  return "Contacto por otro canal";
}

export function Historial({ interacciones }: { interacciones: Interaccion[] }) {
  if (!interacciones.length) return <p className="historial-vacio">Todavía no hay mensajes ni llamadas con este lead.</p>;
  return (
    <ol className="historial">
      {interacciones.map((i) => (
        <li key={i.id} className={`historial-item historial-${i.sentido.toLowerCase()}${i.estado === "FALLIDO" ? " historial-fallido" : ""}`}>
          <div className="historial-linea">
            <b>{titulo(i)}</b>
            {i.resultado && <EstadoChip estado={i.resultado} />}
            {i.estado === "SIMULADO" && <span className="chip" title="Sin SMTP configurado: no salió">Simulado</span>}
            {i.estado === "FALLIDO" && <span className="chip chip-error">Falló</span>}
          </div>
          <div className="historial-meta">
            {fechaHora(i.createdAt)}
            {i.usuario && ` · ${i.usuario.fullName}`}
            {i.destino && ` · ${i.destino}`}
          </div>
          {i.asunto && <div className="historial-asunto">{i.asunto}</div>}
          {i.mensaje && (
            <details className="historial-mensaje">
              <summary>Ver mensaje</summary>
              <p>{i.mensaje}</p>
            </details>
          )}
          {i.nota && <p className="historial-nota">{i.nota}</p>}
          {i.error && <p className="historial-error">{i.error}</p>}
        </li>
      ))}
    </ol>
  );
}
