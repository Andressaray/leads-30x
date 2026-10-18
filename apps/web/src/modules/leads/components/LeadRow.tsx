import { QualityChip, StatusChip } from "@/modules/contact";
import { useSession } from "@/shared/hooks/use-session";
import { Chip } from "@/shared/ui";
import type { Lead } from "../types";

const link = (u: string) => (/^https?:/.test(u) ? u : `https://${u}`);
const label = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40);
const date = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export type TableVariant = "search" | "contacted";

interface LeadRowProps {
  lead: Lead;
  variant: TableVariant;
  /** Opens the lead's contact panel. */
  onOpen: (id: number) => void;
}

/** Name of whoever contacted the lead; "Tú" if it was the session user. */
function WhoContacted({ lead }: { lead: Lead }) {
  const me = useSession()?.user.id;
  if (!lead.contactedBy) return <span className="contacted-by">Sin asignar</span>;
  return lead.contactedBy.id === me ? (
    <span className="you">Tú</span>
  ) : (
    <span title={lead.contactedBy.email}>{lead.contactedBy.fullName}</span>
  );
}

function Status({ lead, onOpen }: { lead: Lead; onOpen: (id: number) => void }) {
  const status = lead.contactStatus ?? (lead.contacted ? "CONTACTED" : "PENDING");
  const pending = status === "PENDING" && !lead.doNotContact;
  return (
    <div className="status-cell">
      {!pending && <StatusChip status={status} doNotContact={lead.doNotContact} />}
      {lead.quality && <QualityChip quality={lead.quality} score={lead.score} />}
      <button type="button" className={pending ? "btn-contact" : "btn-view"} onClick={() => onOpen(lead.id)}>
        {pending ? "Contactar" : "Ver"}
      </button>
    </div>
  );
}

export function LeadRow({ lead, variant, onOpen }: LeadRowProps) {
  const links = [...(lead.websites ?? []), ...(lead.socialLinks ?? [])];

  return (
    <tr>
      <td>
        <b>{lead.name}</b>
        {lead.legalName && lead.legalName !== lead.name && (
          <>
            <br />
            <small>{lead.legalName}</small>
          </>
        )}
      </td>
      <td>{lead.nit ?? ""}</td>
      <td>
        {(lead.phones ?? []).map((t) => (
          <div key={t.number}>
            {t.number}
            {t.whatsapp ? " (WhatsApp)" : ""}
          </div>
        ))}
        {(lead.emails ?? []).map((e) => (
          <div key={e}>{e}</div>
        ))}
        {links.map((u) => (
          <div key={u}>
            <a href={link(u)} target="_blank" rel="noopener noreferrer">
              {label(u)}
            </a>
          </div>
        ))}
      </td>
      <td>{lead.address ?? ""}</td>
      <td>
        {(lead.sources ?? []).map((f) => (
          <Chip key={f}>{f}</Chip>
        ))}
      </td>
      {variant === "contacted" ? (
        <>
          <td>
            <WhoContacted lead={lead} />
          </td>
          <td style={{ whiteSpace: "nowrap" }}>
            {lead.lastContactedAt ? date(lead.lastContactedAt) : lead.contactedAt ? date(lead.contactedAt) : ""}
          </td>
          <td>
            <Status lead={lead} onOpen={onOpen} />
          </td>
        </>
      ) : (
        <td>
          <Status lead={lead} onOpen={onOpen} />
          {lead.contactedBy && (
            <span className="contacted-by">
              por <WhoContacted lead={lead} />
            </span>
          )}
        </td>
      )}
    </tr>
  );
}
