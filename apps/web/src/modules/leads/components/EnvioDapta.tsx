// Manda a Dapta, de una vez, los leads de la página que se pueden calificar.
import { useEffect, useState } from "react";
import { enviarLoteADapta, estadoDapta, type EstadoDapta, type ResultadoLoteDapta } from "@/modules/contacto";
import { mensajeDeError } from "@/shared/lib/http";
import { Aviso } from "@/shared/ui";
import type { Lead } from "../types";

export function EnvioDapta({ leads, onEnviados }: { leads: Lead[]; onEnviados: () => void }) {
  const [dapta, setDapta] = useState<EstadoDapta | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<(ResultadoLoteDapta & { nombres: Map<number, string> }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    estadoDapta().then(setDapta, () => setDapta(null));
  }, []);

  // Ya calificados o que pidieron no ser contactados no se mandan.
  const candidatos = leads.filter((l) => !l.noContactar && !l.calidad);
  if (!dapta || dapta.modo === "desactivado") return null;

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const r = await enviarLoteADapta(candidatos.map((l) => l.id));
      setResultado({ ...r, nombres: new Map(leads.map((l) => [l.id, l.nombre])) });
      setConfirmando(false);
      if (r.enviados) onEnviados();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  const omitidos = resultado?.resultados.filter((r) => !r.ok) ?? [];
  return (
    <div className="envio-dapta">
      {!confirmando ? (
        <div className="envio-dapta-barra">
          <span>
            {candidatos.length
              ? `${candidatos.length} lead${candidatos.length === 1 ? "" : "s"} de esta página sin calificar.`
              : "Todos los leads de esta página ya están calificados."}
            {dapta.modo === "simulado" && " Dapta está en modo simulado: no saldrán."}
          </span>
          <button type="button" className="btn-secundario" disabled={!candidatos.length} onClick={() => setConfirmando(true)}>
            Enviar a Dapta
          </button>
        </div>
      ) : (
        <div className="envio-dapta-barra confirmar">
          <span>
            ¿Mandar {candidatos.length} lead{candidatos.length === 1 ? "" : "s"} a Dapta?
            {dapta.contacta && " El agente los llamará: se aplican las reglas de contacto y los que no se puedan llamar hoy se omiten."}
          </span>
          <div className="confirmar-botones">
            <button type="button" onClick={() => setConfirmando(false)} disabled={enviando}>
              Cancelar
            </button>
            <button type="button" className="btn-primario" onClick={enviar} disabled={enviando}>
              {enviando ? "Enviando…" : "Sí, enviar"}
            </button>
          </div>
        </div>
      )}
      {error && <Aviso tipo="error" className="aviso-compacto" titulo={error} />}
      {resultado && (
        <Aviso
          tipo={resultado.enviados ? "info" : "error"}
          className="aviso-compacto"
          titulo={`${resultado.enviados} enviado${resultado.enviados === 1 ? "" : "s"} a Dapta${omitidos.length ? `, ${omitidos.length} omitido${omitidos.length === 1 ? "" : "s"}` : ""}.`}
          detalles={omitidos.map((o) => `${resultado.nombres.get(o.leadId) ?? `Lead ${o.leadId}`}: ${o.motivo}`)}
        />
      )}
    </div>
  );
}
