import { useSearchParams } from "react-router";
import { useMembers, type Member } from "@/modules/auth";
import { useSession } from "@/shared/hooks/use-session";
import { buildMeta } from "@/shared/seo/meta";
import type { ContactStatus } from "@/modules/contact";
import { Avatar, Notice, TeamIcon, Selector, type SelectorOption } from "@/shared/ui";
import { LeadsPanel } from "./components/LeadsPanel";
import type { LeadFilters } from "./types";

export const meta = () => buildMeta({ title: "Contactados" });

const ALL = "all";

// Filter by the Dapta qualification (?quality=… in the URL).
const QUALITIES: { value: string; label: string; detail: string; className: string }[] = [
  { value: ALL, label: "Toda calidad", detail: "Calificados o no", className: "all" },
  { value: "HIGH", label: "Calidad alta", detail: "Según Dapta o a mano", className: "high" },
  { value: "MEDIUM", label: "Calidad media", detail: "Según Dapta o a mano", className: "medium" },
  { value: "LOW,DISCARDED", label: "Baja o descartados", detail: "Según Dapta o a mano", className: "low" },
  { value: "NONE", label: "Sin calificar", detail: "Para mandar a Dapta", className: "none" },
];

// Filter by how each lead is doing in the funnel (?status=… in the URL).
const STATUSES: { value: string; label: string; detail: string; status?: ContactStatus }[] = [
  { value: ALL, label: "Todos los estados", detail: "Cualquier respuesta" },
  { value: "CONTACTED", label: "Sin respuesta", detail: "Se le escribió o llamó y no ha respondido", status: "CONTACTED" },
  { value: "REPLIED,INTERESTED", label: "Respondieron", detail: "Respondió o está interesado", status: "REPLIED" },
  { value: "INTERESTED", label: "Interesados", detail: "Quieren saber más", status: "INTERESTED" },
  { value: "NOT_INTERESTED", label: "No interesados", detail: "No se les vuelve a escribir", status: "NOT_INTERESTED" },
  { value: "BOUNCED", label: "Rebotaron", detail: "Correo o número que no existe", status: "BOUNCED" },
];
const plural = (n: number, one: string, several: string) => `${n} ${n === 1 ? one : several}`;

export default function ContactedPage() {
  const me = useSession()?.user;
  const isMember = Boolean(me && me.role !== "ADMIN");
  const members = useMembers();

  // ?member=<id> | all and ?page=N go in the URL so they survive reloading and going back and forth
  // from the menu. Without ?member: a SERVICE user sees their own and an ADMIN, the whole team's.
  const [params, setParams] = useSearchParams();
  const raw = params.get("member") ?? (params.get("team") === "1" ? ALL : null);
  const member = raw === ALL || (raw && /^\d+$/.test(raw)) ? raw : isMember && me ? String(me.id) : ALL;
  const page = Math.max(1, Math.trunc(Number(params.get("page"))) || 1);
  const status = STATUSES.find((e) => e.value === params.get("status"))?.value ?? ALL;
  const quality = QUALITIES.find((c) => c.value === params.get("quality"))?.value ?? ALL;

  const filters: LeadFilters = {
    contacted: true,
    ...(member === ALL ? {} : { contacted_by: Number(member) }),
    ...(status === ALL ? {} : { status }),
    ...(quality === ALL ? {} : { quality }),
  };

  function update(changes: Record<string, string | null>) {
    setParams(
      (prev) => {
        const sig = new URLSearchParams(prev);
        sig.delete("team");
        for (const [k, v] of Object.entries(changes)) {
          if (v === null) sig.delete(k);
          else sig.set(k, v);
        }
        return sig;
      },
      { replace: true },
    );
  }

  // Options: the whole team, then you (if you are a member) and then the rest by name.
  const list: Member[] =
    members.status === "ready"
      ? [...members.members].sort((a, b) => Number(b.id === me?.id) - Number(a.id === me?.id))
      : isMember && me
        ? [{ id: me.id, fullName: me.fullName, email: me.email, contacted: NaN }]
        : [];

  const options: SelectorOption[] = [
    {
      value: ALL,
      label: "Todo el equipo",
      detail: members.status === "ready" ? plural(members.members.length, "miembro", "miembros") : "Todos los contactados",
      start: (
        <Avatar size="sm" variant="neutral">
          <TeamIcon />
        </Avatar>
      ),
      separated: list.length > 0,
    },
    ...list.map(
      (m): SelectorOption => ({
        value: String(m.id),
        label: m.fullName,
        detail: Number.isNaN(m.contacted) ? m.email : plural(m.contacted, "lead contactado", "leads contactados"),
        start: <Avatar size="sm" name={m.fullName} />,
        end: m.id === me?.id ? <span className="chip-you">Tú</span> : undefined,
      }),
    ),
  ];

  const selected = list.find((m) => String(m.id) === member);
  const description =
    member === ALL
      ? "Leads a los que alguien del equipo ya les hizo el primer acercamiento."
      : selected?.id === me?.id
        ? "Leads a los que tú ya les hiciste el primer acercamiento."
        : `Leads a los que ${selected?.fullName ?? "este miembro"} ya les hizo el primer acercamiento.`;

  const empty = status !== ALL || quality !== ALL
    ? "No hay leads con esos filtros."
    : member === ALL
      ? "Nadie del equipo ha contactado leads todavía."
      : selected?.id === me?.id
        ? "Todavía no has contactado leads. Dale “Contactar” en la búsqueda."
        : `${selected?.fullName ?? "Este miembro"} todavía no ha contactado leads.`;

  return (
    <section>
      <header className="page-header">
        <h1>Contactados</h1>
      </header>
      <div className="filters-bar">
        <p className="sub">{description}</p>
        <div className="filters-right">
        <Selector
          className="selector-status"
          label="Estado"
          options={STATUSES.map((e) => ({
            value: e.value,
            label: e.label,
            detail: e.detail,
            start: <span className={`status-dot status-${(e.status ?? "all").toLowerCase().replace("_", "-")}`} aria-hidden="true" />,
            separated: e.value === ALL,
          }))}
          value={status}
          onChange={(v) => update({ status: v === ALL ? null : v, page: null })}
        />
        <Selector
          className="selector-status"
          label="Calidad"
          options={QUALITIES.map((c) => ({
            value: c.value,
            label: c.label,
            detail: c.detail,
            start: <span className={`quality-dot quality-${c.className}`} aria-hidden="true" />,
            separated: c.value === ALL,
          }))}
          value={quality}
          onChange={(v) => update({ quality: v === ALL ? null : v, page: null })}
        />
        <Selector
          className="selector-member"
          label="Miembro"
          options={options}
          value={member}
          placeholder={members.status === "loading" ? "Cargando miembros…" : "Miembro"}
          disabled={members.status === "loading" && !isMember}
          onChange={(v) => update({ member: v, page: null })}
        />
        </div>
      </div>
      {members.status === "error" && (
        <Notice type="error" className="notice-compact" title="No se pudo cargar la lista de miembros." details={[members.message]} />
      )}
      <LeadsPanel
        filters={filters}
        variant="contacted"
        page={page}
        onPageChange={(p) => update({ page: p > 1 ? String(p) : null })}
        empty={empty}
        daptaDispatch
      />
    </section>
  );
}
