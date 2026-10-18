import { useEffect, useRef, useState, type FormEvent } from "react";
import { actualizarPlantilla, crearPlantilla, listarVariables, type CanalConPermiso, type Plantilla } from "@/modules/contacto";
import { mensajeDeError } from "@/shared/lib/http";
import { Aviso } from "@/shared/ui";

interface EditorProps {
  /** Sin plantilla: crear una nueva. */
  plantilla?: Plantilla;
  onGuardada: (p: Plantilla) => void;
  onCancelar: () => void;
}

const CANALES: { valor: CanalConPermiso; etiqueta: string }[] = [
  { valor: "EMAIL", etiqueta: "Correo" },
  { valor: "WHATSAPP", etiqueta: "WhatsApp" },
  { valor: "LLAMADA", etiqueta: "Guion de llamada" },
];

export function EditorPlantilla({ plantilla, onGuardada, onCancelar }: EditorProps) {
  const [nombre, setNombre] = useState(plantilla?.nombre ?? "");
  const [canal, setCanal] = useState<CanalConPermiso>(plantilla?.canal ?? "EMAIL");
  const [asunto, setAsunto] = useState(plantilla?.asunto ?? "");
  const [cuerpo, setCuerpo] = useState(plantilla?.cuerpo ?? "");
  const [variables, setVariables] = useState<{ nombre: string; descripcion: string }[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const texto = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listarVariables().then(setVariables, () => setVariables([]));
  }, []);

  /** Inserta {{variable}} donde está el cursor del mensaje. */
  function insertar(variable: string) {
    const el = texto.current;
    const marca = `{{${variable}}}`;
    if (!el) return setCuerpo((c) => c + marca);
    const [ini, fin] = [el.selectionStart, el.selectionEnd];
    setCuerpo(cuerpo.slice(0, ini) + marca + cuerpo.slice(fin));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + marca.length, ini + marca.length);
    });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const datos = { nombre, cuerpo, ...(canal === "EMAIL" ? { asunto } : {}) };
      onGuardada(plantilla ? await actualizarPlantilla(plantilla.id, datos) : await crearPlantilla({ ...datos, canal }));
    } catch (err) {
      setError(mensajeDeError(err));
      setGuardando(false);
    }
  }

  return (
    <form className="editor-plantilla" onSubmit={guardar}>
      <h2>{plantilla ? "Editar plantilla" : "Nueva plantilla"}</h2>
      <div className="fila-2">
        <label>
          Nombre
          <input required minLength={2} maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Correo · primer contacto" />
        </label>
        <label>
          Canal
          <select value={canal} disabled={Boolean(plantilla)} onChange={(e) => setCanal(e.target.value as CanalConPermiso)}>
            {CANALES.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </label>
      </div>
      {canal === "EMAIL" && (
        <label>
          Asunto
          <input required maxLength={150} value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Ej. Una propuesta para {{nombre}}" />
        </label>
      )}
      <label>
        {canal === "LLAMADA" ? "Guion" : "Mensaje"}
        <textarea ref={texto} required minLength={10} maxLength={5000} rows={10} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
      </label>
      {variables.length > 0 && (
        <div className="variables">
          <span>Insertar:</span>
          {variables.map((v) => (
            <button key={v.nombre} type="button" className="variable" title={v.descripcion} onClick={() => insertar(v.nombre)}>
              {`{{${v.nombre}}}`}
            </button>
          ))}
        </div>
      )}
      {canal === "EMAIL" && (
        <p className="ayuda">Al enviar se agrega solo la firma y cómo darse de baja (lo pide la Ley 2300). No hace falta escribirlo.</p>
      )}
      {error && <Aviso tipo="error" className="aviso-compacto" titulo={error} />}
      <div className="editor-botones">
        <button type="button" onClick={onCancelar}>
          Cancelar
        </button>
        <button className="btn-primario" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
