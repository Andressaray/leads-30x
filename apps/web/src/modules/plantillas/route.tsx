import { useCallback, useEffect, useState } from "react";
import { actualizarPlantilla, listarPlantillas, NOMBRE_CANAL, type CanalConPermiso, type Plantilla } from "@/modules/contacto";
import { useSesion } from "@/shared/hooks/use-session";
import { mensajeDeError } from "@/shared/lib/http";
import { cn } from "@/shared/lib/cn";
import { buildMeta } from "@/shared/seo/meta";
import { Aviso, Skeleton } from "@/shared/ui";
import { EditorPlantilla } from "./components/EditorPlantilla";

export const meta = () => buildMeta({ title: "Plantillas" });

const FILTROS: { valor: CanalConPermiso | "todas"; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "EMAIL", etiqueta: "Correo" },
  { valor: "WHATSAPP", etiqueta: "WhatsApp" },
  { valor: "LLAMADA", etiqueta: "Llamada" },
];

type Editor = { modo: "cerrado" } | { modo: "nueva" } | { modo: "editar"; plantilla: Plantilla };

export default function PlantillasPage() {
  const yo = useSesion()?.usuario;
  const [plantillas, setPlantillas] = useState<Plantilla[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<CanalConPermiso | "todas">("todas");
  const [inactivas, setInactivas] = useState(false);
  const [editor, setEditor] = useState<Editor>({ modo: "cerrado" });

  const cargar = useCallback(() => {
    listarPlantillas(undefined, true).then(
      (p) => {
        setPlantillas(p);
        setError(null);
      },
      (err: unknown) => setError(mensajeDeError(err)),
    );
  }, []);
  useEffect(cargar, [cargar]);

  const puedeEditar = (p: Plantilla) => yo?.rol === "ADMIN" || p.creadoPorId === yo?.id;
  const visibles = (plantillas ?? []).filter((p) => (filtro === "todas" || p.canal === filtro) && (inactivas || p.activa));
  const hayInactivas = (plantillas ?? []).some((p) => !p.activa);

  async function alternar(p: Plantilla) {
    try {
      await actualizarPlantilla(p.id, { activa: !p.activa });
      cargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }

  return (
    <section>
      <header className="pagina-cabecera cabecera-con-accion">
        <div>
          <h1>Plantillas</h1>
          <p className="sub">
            Mensajes que el equipo reutiliza al contactar leads. Las variables como <code>{"{{nombre}}"}</code> se reemplazan con los datos de
            cada lead.
          </p>
        </div>
        {editor.modo === "cerrado" && (
          <button type="button" className="btn-primario" onClick={() => setEditor({ modo: "nueva" })}>
            Nueva plantilla
          </button>
        )}
      </header>

      {editor.modo !== "cerrado" && (
        <EditorPlantilla
          key={editor.modo === "editar" ? editor.plantilla.id : "nueva"}
          plantilla={editor.modo === "editar" ? editor.plantilla : undefined}
          onCancelar={() => setEditor({ modo: "cerrado" })}
          onGuardada={() => {
            setEditor({ modo: "cerrado" });
            cargar();
          }}
        />
      )}

      <div className="barra-filtros">
        <div className="pestanas" role="tablist" aria-label="Canal">
          {FILTROS.map((f) => (
            <button key={f.valor} type="button" role="tab" aria-selected={filtro === f.valor} className={cn("pestana", filtro === f.valor && "activa")} onClick={() => setFiltro(f.valor)}>
              {f.etiqueta}
            </button>
          ))}
        </div>
        {hayInactivas && (
          <label className="check">
            <input type="checkbox" checked={inactivas} onChange={(e) => setInactivas(e.target.checked)} />
            Mostrar desactivadas
          </label>
        )}
      </div>

      {error && <Aviso tipo="error" titulo="No se pudieron cargar las plantillas." detalles={[error]} />}
      {!plantillas && !error && (
        <div className="plantillas">
          {[0, 1, 2].map((i) => (
            <div key={i} className="plantilla">
              <Skeleton width="60%" height={14} />
              <Skeleton width="100%" height={90} />
            </div>
          ))}
        </div>
      )}
      {plantillas && visibles.length === 0 && <p className="vacio">No hay plantillas aquí todavía.</p>}
      {visibles.length > 0 && (
        <div className="plantillas">
          {visibles.map((p) => (
            <article key={p.id} className={cn("plantilla", !p.activa && "inactiva")}>
              <div className="plantilla-cabecera">
                <b>{p.nombre}</b>
                <span className="chip">{NOMBRE_CANAL[p.canal]}</span>
                {!p.activa && <span className="chip">Desactivada</span>}
              </div>
              {p.asunto && <div className="plantilla-asunto">{p.asunto}</div>}
              <p className="plantilla-cuerpo">{p.cuerpo}</p>
              <div className="plantilla-pie">
                <span>{p.creadoPor ? `Por ${p.creadoPor.fullName}` : "Plantilla inicial"}</span>
                {puedeEditar(p) && (
                  <span className="plantilla-acciones">
                    <button type="button" className="btn-enlace" onClick={() => setEditor({ modo: "editar", plantilla: p })}>
                      Editar
                    </button>
                    <button type="button" className="btn-enlace" onClick={() => alternar(p)}>
                      {p.activa ? "Desactivar" : "Activar"}
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
