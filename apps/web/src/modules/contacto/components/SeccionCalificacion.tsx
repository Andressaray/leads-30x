// Calificación del lead (punto 4): mandarlo a Dapta, ver lo que devolvió o calificarlo a mano.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { mensajeDeError } from "@/shared/lib/http";
import { cn } from "@/shared/lib/cn";
import { Aviso } from "@/shared/ui";
import { fechaHora, NOMBRE_CALIDAD } from "../estados";
import { calificarManual, enviarADapta, estadoDapta, listarCalificaciones } from "../services/contacto.service";
import type { CalidadLead, Calificacion, EstadoDapta, FichaContacto } from "../types";
import { CalidadChip } from "./CalidadChip";

const ESTADO_ENVIO: Record<Calificacion["estado"], string> = {
  ENVIADO: "Esperando a Dapta",
  SIMULADO: "Simulado (no salió)",
  FALLIDO: "No se pudo enviar",
  CALIFICADO: "Calificado",
  SIN_CONTACTO: "Dapta no logró hablar con el lead",
};

interface Props {
  ficha: FichaContacto;
  /** Si no puede trabajar este lead (es de otra persona). */
  soloLectura: boolean;
  onHecho: (mensaje: string) => void;
}

export function SeccionCalificacion({ ficha, soloLectura, onHecho }: Props) {
  const { lead, permiso } = ficha;
  const [dapta, setDapta] = useState<EstadoDapta | null>(null);
  const [historial, setHistorial] = useState<Calificacion[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    listarCalificaciones(lead.id).then(setHistorial, (err: unknown) => setError(mensajeDeError(err)));
  }, [lead.id]);
  useEffect(() => {
    estadoDapta().then(setDapta, () => setDapta(null));
    cargar();
  }, [cargar]);

  const pendiente = historial?.find((c) => c.origen === "DAPTA" && (c.estado === "ENVIADO" || c.estado === "SIMULADO"));
  // Si el agente de Dapta llama, es una llamada: mismas reglas que el resto de canales.
  const bloqueo = lead.noContactar
    ? "Pidió no volver a ser contactado."
    : dapta?.contacta
      ? (permiso.motivo ?? permiso.porCanal.LLAMADA)
      : null;

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const c = await enviarADapta(lead.id);
      cargar();
      onHecho(c.estado === "SIMULADO" ? "Enviado a Dapta en modo simulado (no salió: falta DAPTA_FLOW_URL)." : "Enviado a Dapta. La calificación llega cuando termine el flujo.");
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="calificacion">
      <div className="calificacion-actual">
        {lead.calidad ? (
          <>
            <CalidadChip calidad={lead.calidad} puntaje={lead.puntaje} />
            {lead.calificadoEn && <span>Calificado el {new Date(lead.calificadoEn).toLocaleDateString("es-CO")}</span>}
          </>
        ) : (
          <span className="tenue">Sin calificar todavía.</span>
        )}
      </div>

      {dapta?.modo === "simulado" && (
        <Aviso tipo="info" className="aviso-compacto" titulo="Dapta en modo simulado">
          Falta DAPTA_FLOW_URL en la API: los envíos se registran pero no salen. Puedes calificar a mano.
        </Aviso>
      )}
      {dapta?.modo === "desactivado" && <Aviso tipo="error" className="aviso-compacto" titulo="La integración con Dapta no está configurada en el servidor." />}
      {pendiente && <p className="ayuda">Enviado a Dapta el {fechaHora(pendiente.createdAt)}: esperando la calificación.</p>}
      {!soloLectura && bloqueo && !pendiente && <Aviso tipo="info" className="aviso-compacto" titulo={`Dapta llama al lead: ${bloqueo}`} />}
      {error && <Aviso tipo="error" className="aviso-compacto" titulo={error} />}

      {!soloLectura && (
        <div className="calificacion-acciones">
          <button
            type="button"
            className="btn-primario"
            disabled={enviando || Boolean(pendiente) || Boolean(bloqueo) || dapta?.modo === "desactivado"}
            title={pendiente ? "Ya está en Dapta esperando la calificación" : (bloqueo ?? undefined)}
            onClick={enviar}
          >
            {enviando ? "Enviando…" : "Enviar a Dapta"}
          </button>
          <button type="button" className="btn-secundario" onClick={() => setManual((v) => !v)} aria-expanded={manual}>
            Calificar a mano
          </button>
        </div>
      )}
      {manual && (
        <FormManual
          leadId={lead.id}
          onHecho={(m) => {
            setManual(false);
            cargar();
            onHecho(m);
          }}
        />
      )}

      {historial && historial.length > 0 && (
        <ol className="historial historial-calificaciones">
          {historial.map((c) => (
            <li key={c.id} className={cn("historial-item", c.estado === "CALIFICADO" ? "historial-entrante" : c.estado === "FALLIDO" && "historial-fallido")}>
              <div className="historial-linea">
                <b>{c.origen === "DAPTA" ? "Dapta" : "Calificación manual"}</b>
                {c.calidad ? <CalidadChip calidad={c.calidad} puntaje={c.puntaje} /> : <span className="chip">{ESTADO_ENVIO[c.estado]}</span>}
              </div>
              <div className="historial-meta">
                {fechaHora(c.calificadoEn ?? c.createdAt)}
                {c.usuario && ` · ${c.origen === "DAPTA" ? "enviado por " : ""}${c.usuario.fullName}`}
              </div>
              {c.resumen && <p className="historial-nota">{c.resumen}</p>}
              {c.error && <p className="historial-error">{c.error}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const CALIDADES: CalidadLead[] = ["ALTA", "MEDIA", "BAJA", "DESCARTADO"];

function FormManual({ leadId, onHecho }: { leadId: number; onHecho: (m: string) => void }) {
  const [calidad, setCalidad] = useState<CalidadLead | null>(null);
  const [puntaje, setPuntaje] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!calidad) return setError("Elige la calidad.");
    setGuardando(true);
    setError(null);
    try {
      await calificarManual(leadId, { calidad, puntaje: puntaje === "" ? undefined : Number(puntaje), nota: nota || undefined });
      onHecho(`Calificado a mano: ${NOMBRE_CALIDAD[calidad].toLowerCase()}.`);
    } catch (err) {
      setError(mensajeDeError(err));
      setGuardando(false);
    }
  }

  return (
    <form className="form-contacto form-manual" onSubmit={guardar}>
      <fieldset className="segmentado">
        <legend>Calidad</legend>
        {CALIDADES.map((c) => (
          <label key={c} className={calidad === c ? "activo" : undefined}>
            <input type="radio" name="calidad" checked={calidad === c} onChange={() => setCalidad(c)} />
            {NOMBRE_CALIDAD[c].replace("Calidad ", "")}
          </label>
        ))}
      </fieldset>
      <div className="fila-2">
        <label>
          Puntaje (opcional)
          <input type="number" min={0} max={100} inputMode="numeric" placeholder="0 a 100" value={puntaje} onChange={(e) => setPuntaje(e.target.value)} />
        </label>
        <label>
          Nota
          <input maxLength={1000} placeholder="Por qué" value={nota} onChange={(e) => setNota(e.target.value)} />
        </label>
      </div>
      {error && <Aviso tipo="error" className="aviso-compacto" titulo={error} />}
      <button className="btn-secundario" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar calificación"}
      </button>
    </form>
  );
}
