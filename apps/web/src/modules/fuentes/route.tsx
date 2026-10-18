// Fuentes: activar o desactivar cada fuente de datos. Solo interfaz (sin API).
import { cn } from "@/shared/lib/cn";
import { buildMeta } from "@/shared/seo/meta";
import { FICHAS_FUENTES } from "./fichas";
import { fuentesStore } from "./store/fuentes-store";
import { useFuentes } from "./use-fuentes";

export const meta = () => buildMeta({ title: "Fuentes" });

export default function FuentesPage() {
  const { estado, activas: lista } = useFuentes();
  const activas = lista.length;

  return (
    <section>
      <header className="pagina-cabecera cabecera-con-accion">
        <div>
          <h1>Fuentes</h1>
          <p className="sub">
            Elige de dónde se sacan los leads. {activas} de {FICHAS_FUENTES.length} activas.
          </p>
        </div>
        <div className="fuentes-acciones">
          <button type="button" className="btn-enlace" onClick={() => fuentesStore.todas(true)} disabled={activas === FICHAS_FUENTES.length}>
            Activar todas
          </button>
          <button type="button" className="btn-enlace" onClick={() => fuentesStore.todas(false)} disabled={activas === 0}>
            Desactivar todas
          </button>
        </div>
      </header>

      <div className="plantillas">
        {FICHAS_FUENTES.map((f) => {
          const activa = estado[f.clave];
          const id = `fuente-${f.clave}`;
          return (
            <article key={f.clave} className={cn("plantilla", !activa && "inactiva")}>
              <div className="plantilla-cabecera">
                <b id={id}>{f.nombre}</b>
                <span className={cn("chip", activa && "chip-ok")}>{activa ? "Activa" : "Desactivada"}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={activa}
                  aria-labelledby={id}
                  className="interruptor"
                  onClick={() => fuentesStore.alternar(f.clave)}
                />
              </div>
              <p className="plantilla-cuerpo">{f.descripcion}</p>
              <p className="fuente-contacto">
                <span>Trae:</span> {f.contacto}
              </p>
              <div className="plantilla-pie">
                <a href={f.enlace} target="_blank" rel="noreferrer">
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
