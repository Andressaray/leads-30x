// Sources: turn each data source on or off. UI only (no API).
import { cn } from "@/shared/lib/cn";
import { buildMeta } from "@/shared/seo/meta";
import { SOURCE_CARDS } from "./cards";
import { sourcesStore } from "./store/sources-store";
import { useSources } from "./use-sources";

export const meta = () => buildMeta({ title: "Fuentes" });

export default function SourcesPage() {
  const { status, active: list } = useSources();
  const active = list.length;

  return (
    <section>
      <header className="page-header header-with-action">
        <div>
          <h1>Fuentes</h1>
          <p className="sub">
            Elige de dónde se sacan los leads. {active} de {SOURCE_CARDS.length} activas.
          </p>
        </div>
        <div className="sources-actions">
          <button type="button" className="btn-link" onClick={() => sourcesStore.all(true)} disabled={active === SOURCE_CARDS.length}>
            Activar todas
          </button>
          <button type="button" className="btn-link" onClick={() => sourcesStore.all(false)} disabled={active === 0}>
            Desactivar todas
          </button>
        </div>
      </header>

      <div className="templates">
        {SOURCE_CARDS.map((f) => {
          const active = status[f.key];
          const id = `fuente-${f.key}`;
          return (
            <article key={f.key} className={cn("template", !active && "inactive")}>
              <div className="template-header">
                <b id={id}>{f.name}</b>
                <span className={cn("chip", active && "chip-ok")}>{active ? "Activa" : "Desactivada"}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  aria-labelledby={id}
                  className="toggle"
                  onClick={() => sourcesStore.toggle(f.key)}
                />
              </div>
              <p className="template-body">{f.description}</p>
              <p className="source-contact">
                <span>Trae:</span> {f.contact}
              </p>
              <div className="template-footer">
                <a href={f.link} target="_blank" rel="noreferrer">
                  Ver fuente
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
