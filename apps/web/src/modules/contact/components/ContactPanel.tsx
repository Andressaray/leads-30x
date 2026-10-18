// Side panel to contact a lead: choose a channel, send or record, note the reply and see the history.
// It opens from the leads table; when it closes, the table refreshes if something changed.
import { useEffect, useId, useRef, useState } from "react";
import { errorMessage } from "@/shared/lib/http";
import { cn } from "@/shared/lib/cn";
import { useSession } from "@/shared/hooks/use-session";
import { Notice, CloseIcon, Skeleton } from "@/shared/ui";
import { useContactSheet } from "../hooks/use-contact-sheet";
import { markDoNotContact } from "../services/contact.service";
import type { ChannelWithPermission, ContactSheet } from "../types";
import { StatusChip } from "./StatusChip";
import { EmailForm, CallForm, ReplyForm, FormWhatsapp } from "./ContactForms";
import { History } from "./History";
import { QualityChip } from "./QualityChip";
import { QualificationSection } from "./QualificationSection";

const TABS: { channel: ChannelWithPermission; label: string }[] = [
  { channel: "EMAIL", label: "Correo" },
  { channel: "WHATSAPP", label: "WhatsApp" },
  { channel: "CALL", label: "Llamada" },
];

const capitalize = (s: string) => s.toLocaleLowerCase("es-CO").replace(/(^|\s)\p{L}/gu, (l) => l.toLocaleUpperCase("es-CO"));

/** Initial tab: the one of the last channel used this week or, otherwise, the first one with data. */
function initialTab(f: ContactSheet): ChannelWithPermission {
  const last = f.interactions.find((i) => i.direction === "OUTBOUND" && i.channel !== "OTHER")?.channel;
  // The Dapta call counts as a call (one-channel-per-week rule).
  if (last && last !== "OTHER") return last === "DAPTA" ? "CALL" : last;
  if (f.channels.email.length) return "EMAIL";
  if (f.channels.whatsapp.length) return "WHATSAPP";
  return "CALL";
}

interface ContactPanelProps {
  leadId: number;
  onClose: (hasChanges: boolean) => void;
}

export function ContactPanel({ leadId, onClose }: ContactPanelProps) {
  const sheet = useContactSheet(leadId);
  const me = useSession()?.user;
  const [changes, setChanges] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  const close = () => onClose(changes);

  // Escape closes; focus moves into the panel and returns to where it was when it closes. The page behind does not scroll.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>(".panel-close")?.focus();
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = scroll;
      previous?.focus({ preventScroll: true });
    };
  }, []);
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function done(message: string) {
    setChanges(true);
    setSuccess(message);
    sheet.reload();
  }

  return (
    <>
      <div className="panel-backdrop" aria-hidden="true" onClick={close} />
      <aside ref={panel} className="contact-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="panel-header">
          <div>
            <h2 id={titleId}>{sheet.status === "ready" ? sheet.sheet.lead.name : "Contactar"}</h2>
            {sheet.status === "ready" && (
              <p>
                {capitalize(sheet.sheet.lead.municipality)}, {sheet.sheet.lead.department}
                {sheet.sheet.lead.contactedBy &&
                  (sheet.sheet.lead.contactedBy.id === me?.id ? " · Lo trabajas tú" : ` · Lo trabaja ${sheet.sheet.lead.contactedBy.fullName}`)}
              </p>
            )}
          </div>
          <button type="button" className="panel-close" onClick={close} aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>

        <div className="panel-body">
          {sheet.status === "loading" && (
            <div className="panel-loading">
              <Skeleton width="40%" height={14} />
              <Skeleton width="100%" height={180} />
              <Skeleton width="70%" height={14} />
            </div>
          )}
          {sheet.status === "error" && <Notice type="error" title="No se pudo cargar el lead." details={[sheet.message]} />}
          {sheet.status === "ready" && (
            <ContactSheetContent key={leadId} sheet={sheet.sheet} templates={sheet.templates} success={success} onDone={done} />
          )}
        </div>
      </aside>
    </>
  );
}

interface ContentProps {
  sheet: ContactSheet;
  templates: Parameters<typeof EmailForm>[0]["templates"];
  success: string | null;
  onDone: (message: string) => void;
}

function ContactSheetContent({ sheet, templates, success, onDone }: ContentProps) {
  const me = useSession()?.user;
  const [tab, setTab] = useState<ChannelWithPermission>(() => initialTab(sheet));
  const { lead, permission } = sheet;
  const channelBlock = permission.reason ?? permission.byChannel[tab];
  // "Hard" blocks (do not contact, not interested, someone else's) hide the forms;
  // hours or frequency blocks leave them visible, with the button disabled and the reason.
  const isSomeoneElses = Boolean(lead.contactedById && lead.contactedById !== me?.id && me?.role !== "ADMIN");
  const hardBlock = lead.doNotContact || lead.contactStatus === "NOT_INTERESTED" || isSomeoneElses;
  const Form = tab === "EMAIL" ? EmailForm : tab === "WHATSAPP" ? FormWhatsapp : CallForm;

  return (
    <>
      <div className="panel-status">
        <StatusChip status={lead.contactStatus} doNotContact={lead.doNotContact} />
        {lead.quality && <QualityChip quality={lead.quality} score={lead.score} />}
        {lead.repliedAt && <span>Respondió el {new Date(lead.repliedAt).toLocaleDateString("es-CO")}</span>}
      </div>

      {success && (
        <div className="notice notice-success" role="status">
          <span aria-hidden>✓</span>
          <div className="notice-title">{success}</div>
        </div>
      )}
      {sheet.email.mode === "simulated" && (
        <Notice type="info" className="notice-compact" title="Correo en modo simulado">
          No hay SMTP configurado: los correos se registran pero no salen. Configura SMTP_HOST en la API para enviarlos.
        </Notice>
      )}
      {sheet.email.mode === "disabled" && (
        <Notice type="error" className="notice-compact" title="El envío de correo no está configurado en el servidor (falta SMTP_HOST)." />
      )}

      <section className="panel-section">
        <h3>Contactar</h3>
        {hardBlock ? (
          <Notice type="error" className="notice-compact" title={permission.reason ?? "No se puede contactar a este lead."} />
        ) : (
          <>
            <div className="tabs" role="tablist" aria-label="Canal">
              {TABS.map((p) => (
                <button
                  key={p.channel}
                  type="button"
                  role="tab"
                  aria-selected={tab === p.channel}
                  className={cn("tab", tab === p.channel && "active")}
                  onClick={() => setTab(p.channel)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {channelBlock && <Notice type="info" className="notice-compact notice-legal" title={channelBlock} />}
            <Form key={tab} sheet={sheet} templates={templates} block={channelBlock} onDone={onDone} />
          </>
        )}
      </section>

      {lead.contactStatus !== "PENDING" && !isSomeoneElses && (
        <section className="panel-section">
          <h3>Registrar respuesta</h3>
          <ReplyForm sheet={sheet} onDone={onDone} />
        </section>
      )}

      <section className="panel-section">
        <h3>Calificación</h3>
        <QualificationSection sheet={sheet} readOnly={isSomeoneElses} onDone={onDone} />
      </section>

      <section className="panel-section">
        <h3>Historial</h3>
        <History interactions={sheet.interactions} />
      </section>

      {!lead.doNotContact && <DoNotContact leadId={lead.id} onDone={onDone} />}
    </>
  );
}

function DoNotContact({ leadId, onDone }: { leadId: number; onDone: (m: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    try {
      await markDoNotContact(leadId, note || undefined);
      onDone("Listo: no se le volverá a escribir ni llamar.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!confirming) {
    return (
      <button type="button" className="btn-link btn-danger" onClick={() => setConfirming(true)}>
        Pidió no volver a ser contactado
      </button>
    );
  }
  return (
    <div className="confirm-unsubscribe">
      <p>Nadie del equipo podrá volver a escribirle ni llamarlo. Esto no se puede deshacer desde la app.</p>
      <input placeholder="Cómo lo pidió (opcional)" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <Notice type="error" className="notice-compact" title={error} />}
      <div className="confirm-buttons">
        <button type="button" onClick={() => setConfirming(false)}>
          Cancelar
        </button>
        <button type="button" className="btn-danger-solid" onClick={confirm}>
          Sí, no contactar más
        </button>
      </div>
    </div>
  );
}
