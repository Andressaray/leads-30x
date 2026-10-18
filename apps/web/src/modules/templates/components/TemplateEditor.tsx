import { useEffect, useRef, useState, type FormEvent } from "react";
import { updateTemplate, createTemplate, listVariables, type ChannelWithPermission, type Template } from "@/modules/contact";
import { errorMessage } from "@/shared/lib/http";
import { Notice } from "@/shared/ui";

interface EditorProps {
  /** Without a template: create a new one. */
  template?: Template;
  onSaved: (p: Template) => void;
  onCancel: () => void;
}

const CHANNELS: { value: ChannelWithPermission; label: string }[] = [
  { value: "EMAIL", label: "Correo" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "CALL", label: "Guion de llamada" },
];

export function TemplateEditor({ template, onSaved, onCancel }: EditorProps) {
  const [name, setName] = useState(template?.name ?? "");
  const [channel, setChannel] = useState<ChannelWithPermission>(template?.channel ?? "EMAIL");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [variables, setVariables] = useState<{ name: string; description: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listVariables().then(setVariables, () => setVariables([]));
  }, []);

  /** Inserts {{variable}} where the message cursor is. */
  function insert(variable: string) {
    const el = text.current;
    const tick = `{{${variable}}}`;
    if (!el) return setBody((c) => c + tick);
    const [ini, end] = [el.selectionStart, el.selectionEnd];
    setBody(body.slice(0, ini) + tick + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + tick.length, ini + tick.length);
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = { name, body, ...(channel === "EMAIL" ? { subject } : {}) };
      onSaved(template ? await updateTemplate(template.id, data) : await createTemplate({ ...data, channel }));
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form className="template-editor" onSubmit={save}>
      <h2>{template ? "Editar plantilla" : "Nueva plantilla"}</h2>
      <div className="row-2">
        <label>
          Nombre
          <input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Correo · primer contacto" />
        </label>
        <label>
          Canal
          <select value={channel} disabled={Boolean(template)} onChange={(e) => setChannel(e.target.value as ChannelWithPermission)}>
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {channel === "EMAIL" && (
        <label>
          Asunto
          <input required maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ej. Una propuesta para {{nombre}}" />
        </label>
      )}
      <label>
        {channel === "CALL" ? "Guion" : "Mensaje"}
        <textarea ref={text} required minLength={10} maxLength={5000} rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      {variables.length > 0 && (
        <div className="variables">
          <span>Insertar:</span>
          {variables.map((v) => (
            <button key={v.name} type="button" className="variable" title={v.description} onClick={() => insert(v.name)}>
              {`{{${v.name}}}`}
            </button>
          ))}
        </div>
      )}
      {channel === "EMAIL" && (
        <p className="help">Al enviar se agrega solo la firma y cómo darse de baja (lo pide la Ley 2300). No hace falta escribirlo.</p>
      )}
      {error && <Notice type="error" className="notice-compact" title={error} />}
      <div className="editor-buttons">
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn-primary" disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
