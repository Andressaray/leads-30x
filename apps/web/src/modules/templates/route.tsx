import { useCallback, useEffect, useState } from "react";
import { updateTemplate, listTemplates, CHANNEL_NAME, type ChannelWithPermission, type Template } from "@/modules/contact";
import { useSession } from "@/shared/hooks/use-session";
import { errorMessage } from "@/shared/lib/http";
import { cn } from "@/shared/lib/cn";
import { buildMeta } from "@/shared/seo/meta";
import { Notice, Skeleton } from "@/shared/ui";
import { TemplateEditor } from "./components/TemplateEditor";

export const meta = () => buildMeta({ title: "Plantillas" });

const FILTERS: { value: ChannelWithPermission | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "EMAIL", label: "Correo" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "CALL", label: "Llamada" },
];

type Editor = { mode: "cerrado" } | { mode: "nueva" } | { mode: "editar"; template: Template };

export default function TemplatesPage() {
  const me = useSession()?.user;
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ChannelWithPermission | "all">("all");
  const [inactive, setInactive] = useState(false);
  const [editor, setEditor] = useState<Editor>({ mode: "cerrado" });

  const load = useCallback(() => {
    listTemplates(undefined, true).then(
      (p) => {
        setTemplates(p);
        setError(null);
      },
      (err: unknown) => setError(errorMessage(err)),
    );
  }, []);
  useEffect(load, [load]);

  const canEdit = (p: Template) => me?.role === "ADMIN" || p.createdById === me?.id;
  const visible = (templates ?? []).filter((p) => (filter === "all" || p.channel === filter) && (inactive || p.active));
  const hasInactive = (templates ?? []).some((p) => !p.active);

  async function toggle(p: Template) {
    try {
      await updateTemplate(p.id, { active: !p.active });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section>
      <header className="page-header header-with-action">
        <div>
          <h1>Plantillas</h1>
          <p className="sub">
            Mensajes que el equipo reutiliza al contactar leads. Las variables como <code>{"{{nombre}}"}</code> se reemplazan con los datos de
            cada lead.
          </p>
        </div>
        {editor.mode === "cerrado" && (
          <button type="button" className="btn-primary" onClick={() => setEditor({ mode: "nueva" })}>
            Nueva plantilla
          </button>
        )}
      </header>

      {editor.mode !== "cerrado" && (
        <TemplateEditor
          key={editor.mode === "editar" ? editor.template.id : "nueva"}
          template={editor.mode === "editar" ? editor.template : undefined}
          onCancel={() => setEditor({ mode: "cerrado" })}
          onSaved={() => {
            setEditor({ mode: "cerrado" });
            load();
          }}
        />
      )}

      <div className="filters-bar">
        <div className="tabs" role="tablist" aria-label="Canal">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" role="tab" aria-selected={filter === f.value} className={cn("tab", filter === f.value && "active")} onClick={() => setFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        {hasInactive && (
          <label className="check">
            <input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} />
            Mostrar desactivadas
          </label>
        )}
      </div>

      {error && <Notice type="error" title="No se pudieron cargar las plantillas." details={[error]} />}
      {!templates && !error && (
        <div className="templates">
          {[0, 1, 2].map((i) => (
            <div key={i} className="template">
              <Skeleton width="60%" height={14} />
              <Skeleton width="100%" height={90} />
            </div>
          ))}
        </div>
      )}
      {templates && visible.length === 0 && <p className="empty">No hay plantillas aquí todavía.</p>}
      {visible.length > 0 && (
        <div className="templates">
          {visible.map((p) => (
            <article key={p.id} className={cn("template", !p.active && "inactive")}>
              <div className="template-header">
                <b>{p.name}</b>
                <span className="chip">{CHANNEL_NAME[p.channel]}</span>
                {!p.active && <span className="chip">Desactivada</span>}
              </div>
              {p.subject && <div className="template-subject">{p.subject}</div>}
              <p className="template-body">{p.body}</p>
              <div className="template-footer">
                <span>{p.createdBy ? `Por ${p.createdBy.fullName}` : "Plantilla inicial"}</span>
                {canEdit(p) && (
                  <span className="template-actions">
                    <button type="button" className="btn-link" onClick={() => setEditor({ mode: "editar", template: p })}>
                      Editar
                    </button>
                    <button type="button" className="btn-link" onClick={() => toggle(p)}>
                      {p.active ? "Desactivar" : "Activar"}
                    </button>
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
