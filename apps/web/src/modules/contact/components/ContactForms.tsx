// Contact panel forms: email (sent from the platform), WhatsApp and call (recorded),
// and the lead's reply. Each one tells the panel when it saved something so it reloads the contact sheet.
import { useEffect, useState, type FormEvent } from "react";
import { errorMessage } from "@/shared/lib/http";
import { Notice } from "@/shared/ui";
import { whatsappLink, CHANNEL_NAME } from "../statuses";
import { sendEmail, recordContact, recordReply, preview } from "../services/contact.service";
import type { Channel, ChannelWithPermission, ContactSheet, Template, ReplyResult } from "../types";

interface FormProps {
  sheet: ContactSheet;
  templates: Template[];
  /** Reason why this channel cannot be used now (general or channel-specific). */
  block: string | null;
  onDone: (message: string) => void;
}

/** Selected template + text already filled with the lead's data (editable). */
function useMessage(leadId: number, templates: Template[], channel: ChannelWithPermission) {
  const own = templates.filter((p) => p.channel === channel);
  const [selected, setSelected] = useState<number | "" | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [footer, setFooter] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Until the person chooses, the channel's first template is used (even if they arrive later).
  const templateId: number | "" = selected ?? own[0]?.id ?? "";

  useEffect(() => {
    if (templateId === "") return;
    let current = true;
    preview(leadId, { templateId })
      .then((r) => {
        if (!current) return;
        setSubject(r.subject ?? "");
        setMessage(r.message);
        setFooter(r.footer);
        setError(null);
      })
      .catch((err: unknown) => current && setError(errorMessage(err)));
    return () => {
      current = false;
    };
  }, [leadId, templateId]);

  return { own, templateId, setTemplateId: setSelected, subject, setSubject, message, setMessage, footer, error };
}

function TemplateSelector({ own, value, onChange }: { own: Template[]; value: number | ""; onChange: (v: number | "") => void }) {
  return (
    <label>
      Plantilla
      <select value={value} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}>
        <option value="">Sin plantilla (escribir)</option>
        {own.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EmailForm({ sheet, templates, block, onDone }: FormProps) {
  const m = useMessage(sheet.lead.id, templates, "EMAIL");
  const [to, setTo] = useState(sheet.channels.email[0] ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const r = await sendEmail(sheet.lead.id, { to, subject: m.subject, message: m.message, templateId: m.templateId || undefined });
      onDone(r.interaction.status === "SIMULATED" ? "Correo registrado (modo simulado: no salió porque no hay SMTP)." : `Correo enviado a ${to}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  if (!sheet.channels.email.length) return <p className="channel-empty">Este lead no tiene correo registrado.</p>;
  return (
    <form className="contact-form" onSubmit={send}>
      <div className="row-2">
        <label>
          Para
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            {sheet.channels.email.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <TemplateSelector own={m.own} value={m.templateId} onChange={m.setTemplateId} />
      </div>
      <label>
        Asunto
        <input required minLength={3} maxLength={150} value={m.subject} onChange={(e) => m.setSubject(e.target.value)} />
      </label>
      <label>
        Mensaje
        <textarea required minLength={10} maxLength={5000} rows={9} value={m.message} onChange={(e) => m.setMessage(e.target.value)} />
      </label>
      {m.footer && (
        <p className="email-footer" title="Se agrega solo al final del correo">
          <span>Se agrega al final:</span> {m.footer}
        </p>
      )}
      {(m.error || error) && <Notice type="error" className="notice-compact" title={error ?? m.error} />}
      <button className="btn-primary" disabled={sending || Boolean(block)} title={block ?? undefined}>
        {sending ? "Enviando…" : "Enviar correo"}
      </button>
    </form>
  );
}

export function FormWhatsapp({ sheet, templates, block, onDone }: FormProps) {
  const m = useMessage(sheet.lead.id, templates, "WHATSAPP");
  const [number, setNumber] = useState(sheet.channels.whatsapp[0] ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open(e: FormEvent) {
    e.preventDefault();
    // The tab opens right away (inside the click, so the browser does not block it) and is filled
    // only if the contact was recorded; if the law or a rule does not allow it, it closes.
    const tab = window.open("", "_blank");
    setSaving(true);
    setError(null);
    try {
      await recordContact(sheet.lead.id, { channel: "WHATSAPP", destination: number, message: m.message, templateId: m.templateId || undefined });
      const url = whatsappLink(number, m.message);
      if (tab) tab.location.href = url;
      else window.location.href = url;
      onDone("WhatsApp registrado. Envía el mensaje en la pestaña que se abrió.");
    } catch (err) {
      tab?.close();
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!sheet.channels.whatsapp.length) return <p className="channel-empty">Este lead no tiene celular ni WhatsApp registrado.</p>;
  return (
    <form className="contact-form" onSubmit={open}>
      <div className="row-2">
        <label>
          Número
          <select value={number} onChange={(e) => setNumber(e.target.value)}>
            {sheet.channels.whatsapp.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <TemplateSelector own={m.own} value={m.templateId} onChange={m.setTemplateId} />
      </div>
      <label>
        Mensaje
        <textarea rows={6} maxLength={5000} value={m.message} onChange={(e) => m.setMessage(e.target.value)} />
      </label>
      <p className="help">Se abre WhatsApp con el mensaje escrito y queda registrado en el historial.</p>
      {(m.error || error) && <Notice type="error" className="notice-compact" title={error ?? m.error} />}
      <button className="btn-primary" disabled={saving || Boolean(block)} title={block ?? undefined}>
        {saving ? "Registrando…" : "Abrir WhatsApp y registrar"}
      </button>
    </form>
  );
}

export function CallForm({ sheet, templates, block, onDone }: FormProps) {
  const m = useMessage(sheet.lead.id, templates, "CALL");
  const [number, setNumber] = useState(sheet.channels.phone[0] ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function register(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await recordContact(sheet.lead.id, { channel: "CALL", destination: number, note, templateId: m.templateId || undefined });
      setNote("");
      onDone("Llamada registrada. Si contestó, registra cómo respondió.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!sheet.channels.phone.length) return <p className="channel-empty">Este lead no tiene teléfono registrado.</p>;
  return (
    <form className="contact-form" onSubmit={register}>
      <div className="row-2">
        <label>
          Número
          <select value={number} onChange={(e) => setNumber(e.target.value)}>
            {sheet.channels.phone.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <TemplateSelector own={m.own} value={m.templateId} onChange={m.setTemplateId} />
      </div>
      <a className="btn-call" href={`tel:${number.replace(/[^\d+]/g, "")}`}>
        Llamar a {number}
      </a>
      {m.message && (
        <div className="script">
          <span>Guion</span>
          <p>{m.message}</p>
        </div>
      )}
      <label>
        Nota de la llamada
        <textarea rows={3} maxLength={1000} placeholder="Con quién hablaste, qué te dijeron…" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {(m.error || error) && <Notice type="error" className="notice-compact" title={error ?? m.error} />}
      <button className="btn-primary" disabled={saving || Boolean(block)} title={block ?? undefined}>
        {saving ? "Registrando…" : "Registrar llamada"}
      </button>
    </form>
  );
}

const RESULTS: { value: ReplyResult; label: string; detail: string }[] = [
  { value: "REPLIED", label: "Respondió", detail: "Contestó, aún sin definir" },
  { value: "INTERESTED", label: "Interesado", detail: "Quiere saber más" },
  { value: "NOT_INTERESTED", label: "No interesado", detail: "No se le vuelve a escribir" },
  { value: "BOUNCED", label: "Rebotó", detail: "Correo o número no existe" },
];

export function ReplyForm({ sheet, onDone }: Pick<FormProps, "sheet" | "onDone">) {
  const lastChannel = sheet.interactions.find((i) => i.direction === "OUTBOUND")?.channel ?? "EMAIL";
  const [channel, setChannel] = useState<Channel>(lastChannel);
  const [result, setResult] = useState<ReplyResult | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!result) return setError("Elige cómo respondió.");
    setSaving(true);
    setError(null);
    try {
      await recordReply(sheet.lead.id, { channel, result, note: note || undefined });
      setResult(null);
      setNote("");
      onDone("Respuesta registrada.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="contact-form" onSubmit={save}>
      <fieldset className="reply-options">
        <legend>¿Cómo respondió?</legend>
        {RESULTS.map((r) => (
          <label key={r.value} className={result === r.value ? "selected" : undefined}>
            <input type="radio" name="result" value={r.value} checked={result === r.value} onChange={() => setResult(r.value)} />
            <b>{r.label}</b>
            <span>{r.detail}</span>
          </label>
        ))}
      </fieldset>
      <div className="row-2">
        <label>
          Por dónde
          <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            {(["EMAIL", "WHATSAPP", "CALL", "DAPTA", "OTHER"] as const).map((c) => (
              <option key={c} value={c}>
                {CHANNEL_NAME[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nota
          <input maxLength={1000} placeholder="Opcional" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      {error && <Notice type="error" className="notice-compact" title={error} />}
      <button className="btn-secondary" disabled={saving}>
        {saving ? "Guardando…" : "Guardar respuesta"}
      </button>
    </form>
  );
}
