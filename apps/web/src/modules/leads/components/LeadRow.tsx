import { CalidadChip, EstadoChip } from "@/modules/contacto";
import { useSesion } from "@/shared/hooks/use-session";
import { Chip } from "@/shared/ui";
import type { Lead } from "../types";

const enlace = (u: string) => (/^https?:/.test(u) ? u : `https://${u}`);
const etiqueta = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40);
const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export type VarianteTabla = "busqueda" | "contactados";

interface LeadRowProps {
  lead: Lead;
  variante: VarianteTabla;
  /** Abre el panel de contacto del lead. */
  onAbrir: (id: number) => void;
}

/** Nombre de quien contactó el lead; "Tú" si fue el usuario de la sesión. */
function QuienContacto({ lead }: { lead: Lead }) {
  const yo = useSesion()?.usuario.id;
  if (!lead.contactadoPor) return <span className="contactado-por">Sin asignar</span>;
  return lead.contactadoPor.id === yo ? (
    <span className="tu">Tú</span>
  ) : (
    <span title={lead.contactadoPor.email}>{lead.contactadoPor.fullName}</span>
  );
}

function Estado({ lead, onAbrir }: { lead: Lead; onAbrir: (id: number) => void }) {
  const estado = lead.estadoContacto ?? (lead.contactado ? "CONTACTADO" : "PENDIENTE");
  const pendiente = estado === "PENDIENTE" && !lead.noContactar;
  return (
    <div className="celda-estado">
      {!pendiente && <EstadoChip estado={estado} noContactar={lead.noContactar} />}
      {lead.calidad && <CalidadChip calidad={lead.calidad} puntaje={lead.puntaje} />}
      <button type="button" className={pendiente ? "btn-contactar" : "btn-ver"} onClick={() => onAbrir(lead.id)}>
        {pendiente ? "Contactar" : "Ver"}
      </button>
    </div>
  );
}

export function LeadRow({ lead, variante, onAbrir }: LeadRowProps) {
  const enlaces = [...(lead.sitiosWeb ?? []), ...(lead.redes ?? [])];

  return (
    <tr>
      <td>
        <b>{lead.nombre}</b>
        {lead.razonSocial && lead.razonSocial !== lead.nombre && (
          <>
            <br />
            <small>{lead.razonSocial}</small>
          </>
        )}
      </td>
      <td>{lead.nit ?? ""}</td>
      <td>
        {(lead.telefonos ?? []).map((t) => (
          <div key={t.numero}>
            {t.numero}
            {t.whatsapp ? " (WhatsApp)" : ""}
          </div>
        ))}
        {(lead.emails ?? []).map((e) => (
          <div key={e}>{e}</div>
        ))}
        {enlaces.map((u) => (
          <div key={u}>
            <a href={enlace(u)} target="_blank" rel="noopener noreferrer">
              {etiqueta(u)}
            </a>
          </div>
        ))}
      </td>
      <td>{lead.direccion ?? ""}</td>
      <td>
        {(lead.fuentes ?? []).map((f) => (
          <Chip key={f}>{f}</Chip>
        ))}
      </td>
      {variante === "contactados" ? (
        <>
          <td>
            <QuienContacto lead={lead} />
          </td>
          <td style={{ whiteSpace: "nowrap" }}>
            {lead.ultimoContactoEn ? fecha(lead.ultimoContactoEn) : lead.contactadoEn ? fecha(lead.contactadoEn) : ""}
          </td>
          <td>
            <Estado lead={lead} onAbrir={onAbrir} />
          </td>
        </>
      ) : (
        <td>
          <Estado lead={lead} onAbrir={onAbrir} />
          {lead.contactadoPor && (
            <span className="contactado-por">
              por <QuienContacto lead={lead} />
            </span>
          )}
        </td>
      )}
    </tr>
  );
}
