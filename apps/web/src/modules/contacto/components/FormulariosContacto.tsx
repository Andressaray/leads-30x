// Formularios del panel de contacto: correo (sale desde la plataforma), WhatsApp y llamada (se registran),
// y la respuesta del lead. Cada uno avisa al panel cuando guardó algo para recargar la ficha.
import { useEffect, useState, type FormEvent } from "react";
import { mensajeDeError } from "@/shared/lib/http";
import { Aviso } from "@/shared/ui";
import { enlaceWhatsapp, NOMBRE_CANAL } from "../estados";
import { enviarCorreo, registrarContacto, registrarRespuesta, vistaPrevia } from "../services/contacto.service";
import type { Canal, CanalConPermiso, FichaContacto, Plantilla, ResultadoRespuesta } from "../types";

interface FormProps {
  ficha: FichaContacto;
  plantillas: Plantilla[];
  /** Motivo por el que no se puede usar este canal ahora (general o del canal). */
  bloqueo: string | null;
  onHecho: (mensaje: string) => void;
}

/** Plantilla elegida + texto ya rellenado con los datos del lead (editable). */
function useMensaje(leadId: number, plantillas: Plantilla[], canal: CanalConPermiso) {
  const propias = plantillas.filter((p) => p.canal === canal);
  const [elegida, setElegida] = useState<number | "" | null>(null);
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [pie, setPie] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Mientras la persona no elija, se usa la primera plantilla del canal (aunque lleguen después).
  const plantillaId: number | "" = elegida ?? propias[0]?.id ?? "";

  useEffect(() => {
    if (plantillaId === "") return;
    let vigente = true;
    vistaPrevia(leadId, { plantillaId })
      .then((r) => {
        if (!vigente) return;
        setAsunto(r.asunto ?? "");
        setMensaje(r.mensaje);
        setPie(r.pie);
        setError(null);
      })
      .catch((err: unknown) => vigente && setError(mensajeDeError(err)));
    return () => {
      vigente = false;
    };
  }, [leadId, plantillaId]);

  return { propias, plantillaId, setPlantillaId: setElegida, asunto, setAsunto, mensaje, setMensaje, pie, error };
}

function SelectorPlantilla({ propias, valor, onCambiar }: { propias: Plantilla[]; valor: number | ""; onCambiar: (v: number | "") => void }) {
  return (
    <label>
      Plantilla
      <select value={valor} onChange={(e) => onCambiar(e.target.value ? Number(e.target.value) : "")}>
        <option value="">Sin plantilla (escribir)</option>
        {propias.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FormCorreo({ ficha, plantillas, bloqueo, onHecho }: FormProps) {
  const m = useMensaje(ficha.lead.id, plantillas, "EMAIL");
  const [para, setPara] = useState(ficha.canales.email[0] ?? "");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await enviarCorreo(ficha.lead.id, { para, asunto: m.asunto, mensaje: m.mensaje, plantillaId: m.plantillaId || undefined });
      onHecho(r.interaccion.estado === "SIMULADO" ? "Correo registrado (modo simulado: no salió porque no hay SMTP)." : `Correo enviado a ${para}.`);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  if (!ficha.canales.email.length) return <p className="canal-vacio">Este lead no tiene correo registrado.</p>;
  return (
    <form className="form-contacto" onSubmit={enviar}>
      <div className="fila-2">
        <label>
          Para
          <select value={para} onChange={(e) => setPara(e.target.value)}>
            {ficha.canales.email.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <SelectorPlantilla propias={m.propias} valor={m.plantillaId} onCambiar={m.setPlantillaId} />
      </div>
      <label>
        Asunto
        <input required minLength={3} maxLength={150} value={m.asunto} onChange={(e) => m.setAsunto(e.target.value)} />
      </label>
      <label>
        Mensaje
        <textarea required minLength={10} maxLength={5000} rows={9} value={m.mensaje} onChange={(e) => m.setMensaje(e.target.value)} />
      </label>
      {m.pie && (
        <p className="pie-correo" title="Se agrega solo al final del correo">
          <span>Se agrega al final:</span> {m.pie}
        </p>
      )}
      {(m.error || error) && <Aviso tipo="error" className="aviso-compacto" titulo={error ?? m.error} />}
      <button className="btn-primario" disabled={enviando || Boolean(bloqueo)} title={bloqueo ?? undefined}>
        {enviando ? "Enviando…" : "Enviar correo"}
      </button>
    </form>
  );
}

export function FormWhatsapp({ ficha, plantillas, bloqueo, onHecho }: FormProps) {
  const m = useMensaje(ficha.lead.id, plantillas, "WHATSAPP");
  const [numero, setNumero] = useState(ficha.canales.whatsapp[0] ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function abrir(e: FormEvent) {
    e.preventDefault();
    // La pestaña se abre ya (dentro del clic, para que el navegador no la bloquee) y se llena
    // solo si el contacto quedó registrado; si la ley o una regla no lo permite, se cierra.
    const pestana = window.open("", "_blank");
    setGuardando(true);
    setError(null);
    try {
      await registrarContacto(ficha.lead.id, { canal: "WHATSAPP", destino: numero, mensaje: m.mensaje, plantillaId: m.plantillaId || undefined });
      const url = enlaceWhatsapp(numero, m.mensaje);
      if (pestana) pestana.location.href = url;
      else window.location.href = url;
      onHecho("WhatsApp registrado. Envía el mensaje en la pestaña que se abrió.");
    } catch (err) {
      pestana?.close();
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  }

  if (!ficha.canales.whatsapp.length) return <p className="canal-vacio">Este lead no tiene celular ni WhatsApp registrado.</p>;
  return (
    <form className="form-contacto" onSubmit={abrir}>
      <div className="fila-2">
        <label>
          Número
          <select value={numero} onChange={(e) => setNumero(e.target.value)}>
            {ficha.canales.whatsapp.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <SelectorPlantilla propias={m.propias} valor={m.plantillaId} onCambiar={m.setPlantillaId} />
      </div>
      <label>
        Mensaje
        <textarea rows={6} maxLength={5000} value={m.mensaje} onChange={(e) => m.setMensaje(e.target.value)} />
      </label>
      <p className="ayuda">Se abre WhatsApp con el mensaje escrito y queda registrado en el historial.</p>
      {(m.error || error) && <Aviso tipo="error" className="aviso-compacto" titulo={error ?? m.error} />}
      <button className="btn-primario" disabled={guardando || Boolean(bloqueo)} title={bloqueo ?? undefined}>
        {guardando ? "Registrando…" : "Abrir WhatsApp y registrar"}
      </button>
    </form>
  );
}

export function FormLlamada({ ficha, plantillas, bloqueo, onHecho }: FormProps) {
  const m = useMensaje(ficha.lead.id, plantillas, "LLAMADA");
  const [numero, setNumero] = useState(ficha.canales.telefono[0] ?? "");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function registrar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await registrarContacto(ficha.lead.id, { canal: "LLAMADA", destino: numero, nota, plantillaId: m.plantillaId || undefined });
      setNota("");
      onHecho("Llamada registrada. Si contestó, registra cómo respondió.");
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  }

  if (!ficha.canales.telefono.length) return <p className="canal-vacio">Este lead no tiene teléfono registrado.</p>;
  return (
    <form className="form-contacto" onSubmit={registrar}>
      <div className="fila-2">
        <label>
          Número
          <select value={numero} onChange={(e) => setNumero(e.target.value)}>
            {ficha.canales.telefono.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <SelectorPlantilla propias={m.propias} valor={m.plantillaId} onCambiar={m.setPlantillaId} />
      </div>
      <a className="btn-llamar" href={`tel:${numero.replace(/[^\d+]/g, "")}`}>
        Llamar a {numero}
      </a>
      {m.mensaje && (
        <div className="guion">
          <span>Guion</span>
          <p>{m.mensaje}</p>
        </div>
      )}
      <label>
        Nota de la llamada
        <textarea rows={3} maxLength={1000} placeholder="Con quién hablaste, qué te dijeron…" value={nota} onChange={(e) => setNota(e.target.value)} />
      </label>
      {(m.error || error) && <Aviso tipo="error" className="aviso-compacto" titulo={error ?? m.error} />}
      <button className="btn-primario" disabled={guardando || Boolean(bloqueo)} title={bloqueo ?? undefined}>
        {guardando ? "Registrando…" : "Registrar llamada"}
      </button>
    </form>
  );
}

const RESULTADOS: { valor: ResultadoRespuesta; etiqueta: string; detalle: string }[] = [
  { valor: "RESPONDIO", etiqueta: "Respondió", detalle: "Contestó, aún sin definir" },
  { valor: "INTERESADO", etiqueta: "Interesado", detalle: "Quiere saber más" },
  { valor: "NO_INTERESADO", etiqueta: "No interesado", detalle: "No se le vuelve a escribir" },
  { valor: "REBOTADO", etiqueta: "Rebotó", detalle: "Correo o número no existe" },
];

export function FormRespuesta({ ficha, onHecho }: Pick<FormProps, "ficha" | "onHecho">) {
  const ultimoCanal = ficha.interacciones.find((i) => i.sentido === "SALIENTE")?.canal ?? "EMAIL";
  const [canal, setCanal] = useState<Canal>(ultimoCanal);
  const [resultado, setResultado] = useState<ResultadoRespuesta | null>(null);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!resultado) return setError("Elige cómo respondió.");
    setGuardando(true);
    setError(null);
    try {
      await registrarRespuesta(ficha.lead.id, { canal, resultado, nota: nota || undefined });
      setResultado(null);
      setNota("");
      onHecho("Respuesta registrada.");
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="form-contacto" onSubmit={guardar}>
      <fieldset className="opciones-respuesta">
        <legend>¿Cómo respondió?</legend>
        {RESULTADOS.map((r) => (
          <label key={r.valor} className={resultado === r.valor ? "elegida" : undefined}>
            <input type="radio" name="resultado" value={r.valor} checked={resultado === r.valor} onChange={() => setResultado(r.valor)} />
            <b>{r.etiqueta}</b>
            <span>{r.detalle}</span>
          </label>
        ))}
      </fieldset>
      <div className="fila-2">
        <label>
          Por dónde
          <select value={canal} onChange={(e) => setCanal(e.target.value as Canal)}>
            {(["EMAIL", "WHATSAPP", "LLAMADA", "DAPTA", "OTRO"] as const).map((c) => (
              <option key={c} value={c}>
                {NOMBRE_CANAL[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nota
          <input maxLength={1000} placeholder="Opcional" value={nota} onChange={(e) => setNota(e.target.value)} />
        </label>
      </div>
      {error && <Aviso tipo="error" className="aviso-compacto" titulo={error} />}
      <button className="btn-secundario" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar respuesta"}
      </button>
    </form>
  );
}
