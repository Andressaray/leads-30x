import { useSearchParams } from "react-router";
import { useMiembros, type Miembro } from "@/modules/auth";
import { useSesion } from "@/shared/hooks/use-session";
import { buildMeta } from "@/shared/seo/meta";
import type { EstadoContacto } from "@/modules/contacto";
import { Avatar, Aviso, IconoEquipo, Selector, type OpcionSelector } from "@/shared/ui";
import { LeadsPanel } from "./components/LeadsPanel";
import type { FiltrosLeads } from "./types";

export const meta = () => buildMeta({ title: "Contactados" });

const TODOS = "todos";

// Filtro por la calificación de Dapta (?calidad=… en la URL).
const CALIDADES: { valor: string; etiqueta: string; detalle: string; clase: string }[] = [
  { valor: TODOS, etiqueta: "Toda calidad", detalle: "Calificados o no", clase: "todos" },
  { valor: "ALTA", etiqueta: "Calidad alta", detalle: "Según Dapta o a mano", clase: "alta" },
  { valor: "MEDIA", etiqueta: "Calidad media", detalle: "Según Dapta o a mano", clase: "media" },
  { valor: "BAJA,DESCARTADO", etiqueta: "Baja o descartados", detalle: "Según Dapta o a mano", clase: "baja" },
  { valor: "SIN", etiqueta: "Sin calificar", detalle: "Para mandar a Dapta", clase: "sin" },
];

// Filtro por cómo va cada lead en el embudo (?estado=… en la URL).
const ESTADOS: { valor: string; etiqueta: string; detalle: string; estado?: EstadoContacto }[] = [
  { valor: TODOS, etiqueta: "Todos los estados", detalle: "Cualquier respuesta" },
  { valor: "CONTACTADO", etiqueta: "Sin respuesta", detalle: "Se le escribió o llamó y no ha respondido", estado: "CONTACTADO" },
  { valor: "RESPONDIO,INTERESADO", etiqueta: "Respondieron", detalle: "Respondió o está interesado", estado: "RESPONDIO" },
  { valor: "INTERESADO", etiqueta: "Interesados", detalle: "Quieren saber más", estado: "INTERESADO" },
  { valor: "NO_INTERESADO", etiqueta: "No interesados", detalle: "No se les vuelve a escribir", estado: "NO_INTERESADO" },
  { valor: "REBOTADO", etiqueta: "Rebotaron", detalle: "Correo o número que no existe", estado: "REBOTADO" },
];
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export default function ContactadosPage() {
  const yo = useSesion()?.usuario;
  const soyMiembro = Boolean(yo && yo.rol !== "ADMIN");
  const miembros = useMiembros();

  // ?miembro=<id> | todos y ?pagina=N van en la URL para que sobrevivan a recargar y a ir y volver
  // desde el menú. Sin ?miembro: un SERVICE ve los suyos y un ADMIN, los de todo el equipo.
  const [params, setParams] = useSearchParams();
  const crudo = params.get("miembro") ?? (params.get("equipo") === "1" ? TODOS : null);
  const miembro = crudo === TODOS || (crudo && /^\d+$/.test(crudo)) ? crudo : soyMiembro && yo ? String(yo.id) : TODOS;
  const pagina = Math.max(1, Math.trunc(Number(params.get("pagina"))) || 1);
  const estado = ESTADOS.find((e) => e.valor === params.get("estado"))?.valor ?? TODOS;
  const calidad = CALIDADES.find((c) => c.valor === params.get("calidad"))?.valor ?? TODOS;

  const filtros: FiltrosLeads = {
    contactado: true,
    ...(miembro === TODOS ? {} : { contactado_por: Number(miembro) }),
    ...(estado === TODOS ? {} : { estado }),
    ...(calidad === TODOS ? {} : { calidad }),
  };

  function actualizar(cambios: Record<string, string | null>) {
    setParams(
      (prev) => {
        const sig = new URLSearchParams(prev);
        sig.delete("equipo");
        for (const [k, v] of Object.entries(cambios)) {
          if (v === null) sig.delete(k);
          else sig.set(k, v);
        }
        return sig;
      },
      { replace: true },
    );
  }

  // Opciones: todo el equipo, luego tú (si eres miembro) y luego el resto por nombre.
  const lista: Miembro[] =
    miembros.estado === "listo"
      ? [...miembros.miembros].sort((a, b) => Number(b.id === yo?.id) - Number(a.id === yo?.id))
      : soyMiembro && yo
        ? [{ id: yo.id, fullName: yo.fullName, email: yo.email, contactados: NaN }]
        : [];

  const opciones: OpcionSelector[] = [
    {
      valor: TODOS,
      etiqueta: "Todo el equipo",
      detalle: miembros.estado === "listo" ? plural(miembros.miembros.length, "miembro", "miembros") : "Todos los contactados",
      inicio: (
        <Avatar tamano="sm" variante="neutro">
          <IconoEquipo />
        </Avatar>
      ),
      separada: lista.length > 0,
    },
    ...lista.map(
      (m): OpcionSelector => ({
        valor: String(m.id),
        etiqueta: m.fullName,
        detalle: Number.isNaN(m.contactados) ? m.email : plural(m.contactados, "lead contactado", "leads contactados"),
        inicio: <Avatar tamano="sm" nombre={m.fullName} />,
        fin: m.id === yo?.id ? <span className="chip-tu">Tú</span> : undefined,
      }),
    ),
  ];

  const elegido = lista.find((m) => String(m.id) === miembro);
  const descripcion =
    miembro === TODOS
      ? "Leads a los que alguien del equipo ya les hizo el primer acercamiento."
      : elegido?.id === yo?.id
        ? "Leads a los que tú ya les hiciste el primer acercamiento."
        : `Leads a los que ${elegido?.fullName ?? "este miembro"} ya les hizo el primer acercamiento.`;

  const vacio = estado !== TODOS || calidad !== TODOS
    ? "No hay leads con esos filtros."
    : miembro === TODOS
      ? "Nadie del equipo ha contactado leads todavía."
      : elegido?.id === yo?.id
        ? "Todavía no has contactado leads. Dale “Contactar” en la búsqueda."
        : `${elegido?.fullName ?? "Este miembro"} todavía no ha contactado leads.`;

  return (
    <section>
      <header className="pagina-cabecera">
        <h1>Contactados</h1>
      </header>
      <div className="barra-filtros">
        <p className="sub">{descripcion}</p>
        <div className="filtros-derecha">
        <Selector
          className="selector-estado"
          etiqueta="Estado"
          opciones={ESTADOS.map((e) => ({
            valor: e.valor,
            etiqueta: e.etiqueta,
            detalle: e.detalle,
            inicio: <span className={`estado-punto estado-${(e.estado ?? "todos").toLowerCase().replace("_", "-")}`} aria-hidden="true" />,
            separada: e.valor === TODOS,
          }))}
          valor={estado}
          onCambiar={(v) => actualizar({ estado: v === TODOS ? null : v, pagina: null })}
        />
        <Selector
          className="selector-estado"
          etiqueta="Calidad"
          opciones={CALIDADES.map((c) => ({
            valor: c.valor,
            etiqueta: c.etiqueta,
            detalle: c.detalle,
            inicio: <span className={`calidad-punto calidad-${c.clase}`} aria-hidden="true" />,
            separada: c.valor === TODOS,
          }))}
          valor={calidad}
          onCambiar={(v) => actualizar({ calidad: v === TODOS ? null : v, pagina: null })}
        />
        <Selector
          className="selector-miembro"
          etiqueta="Miembro"
          opciones={opciones}
          valor={miembro}
          placeholder={miembros.estado === "cargando" ? "Cargando miembros…" : "Miembro"}
          deshabilitado={miembros.estado === "cargando" && !soyMiembro}
          onCambiar={(v) => actualizar({ miembro: v, pagina: null })}
        />
        </div>
      </div>
      {miembros.estado === "error" && (
        <Aviso tipo="error" className="aviso-compacto" titulo="No se pudo cargar la lista de miembros." detalles={[miembros.mensaje]} />
      )}
      <LeadsPanel
        filtros={filtros}
        variante="contactados"
        pagina={pagina}
        onCambiarPagina={(p) => actualizar({ pagina: p > 1 ? String(p) : null })}
        vacio={vacio}
        envioDapta
      />
    </section>
  );
}
