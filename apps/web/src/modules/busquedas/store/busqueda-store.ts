// Estado de "Buscar leads" fuera del componente: el formulario, el resultado y la página de la
// tabla sobreviven al cambiar de sección (la página se desmonta, el store no). Una búsqueda en
// curso sigue consultando su estado aunque salgas a Contactados.
// Se guarda además en sessionStorage (por usuario) para que aguante una recarga de la pestaña.
import { ApiError, mensajeDeError } from "@/shared/lib/http";
import { sessionStore } from "@/shared/lib/session-store";
import { crearBusqueda } from "../services/busquedas.service";
import type { CandidatoMunicipio, CrearBusqueda, ResultadoBusqueda } from "../types";

export interface FormBusqueda {
  departamento: string;
  codigo: string;
  categoria: string;
}

export type EstadoBusqueda =
  | { estado: "inactiva" }
  | { estado: "buscando" }
  | { estado: "lista"; resultado: ResultadoBusqueda }
  | { estado: "error"; titulo: string; detalles: string[] };

export interface SnapshotBusqueda {
  form: FormBusqueda;
  busqueda: EstadoBusqueda;
  /** Página de la tabla de leads del resultado. */
  pagina: number;
}

const CLAVE = "leads_busqueda";
const VACIO: SnapshotBusqueda = {
  form: { departamento: "", codigo: "", categoria: "" },
  busqueda: { estado: "inactiva" },
  pagina: 1,
};

const oyentes = new Set<() => void>();
let actual: SnapshotBusqueda = VACIO;
/** Clave de almacenamiento del usuario al que pertenece `actual` (undefined = aún no se ha leído). */
let actualDe: string | null | undefined;
let control: AbortController | null = null;

const claveUsuario = () => {
  const s = sessionStore.get();
  return s ? `${CLAVE}:${s.usuario.id}` : null;
};

function cargar(clave: string | null): SnapshotBusqueda {
  if (!clave) return VACIO;
  try {
    const crudo = globalThis.sessionStorage?.getItem(clave);
    if (!crudo) return VACIO;
    const v = JSON.parse(crudo) as SnapshotBusqueda;
    if (!v?.form || !v.busqueda) return VACIO;
    // Si la pestaña se recargó a mitad de una búsqueda, ya no hay quién la siga consultando.
    return v.busqueda.estado === "buscando" ? { ...v, busqueda: { estado: "inactiva" } } : v;
  } catch {
    return VACIO;
  }
}

function get(): SnapshotBusqueda {
  const clave = claveUsuario();
  if (clave !== actualDe) {
    actualDe = clave;
    actual = cargar(clave);
  }
  return actual;
}

function set(cambios: Partial<SnapshotBusqueda>) {
  get();
  actual = { ...actual, ...cambios };
  try {
    if (actualDe) globalThis.sessionStorage?.setItem(actualDe, JSON.stringify(actual));
  } catch {
    // sin persistencia: queda en memoria mientras la pestaña siga abierta
  }
  oyentes.forEach((fn) => fn());
}

// Al cerrar sesión se descarta todo (y se corta la búsqueda en curso, si la hay).
sessionStore.subscribe(() => {
  if (sessionStore.get()) return;
  control?.abort();
  control = null;
  try {
    if (actualDe) globalThis.sessionStorage?.removeItem(actualDe);
  } catch {
    // nada que limpiar
  }
  actual = VACIO;
  actualDe = null;
  oyentes.forEach((fn) => fn());
});

function esFallaDeFuentes(err: unknown): err is ApiError & { details: { porFuente: Record<string, { error?: string | null }> } } {
  return err instanceof ApiError && err.status === 502 && typeof (err.details as { porFuente?: unknown } | undefined)?.porFuente === "object";
}

function esAmbigua(err: unknown): err is ApiError & { details: { candidatos: CandidatoMunicipio[] } } {
  return (
    err instanceof ApiError &&
    err.status === 409 &&
    Array.isArray((err.details as { candidatos?: unknown } | undefined)?.candidatos)
  );
}

async function buscar(datos: CrearBusqueda) {
  // Una búsqueda nueva deja de consultar el estado de la anterior.
  control?.abort();
  const propio = new AbortController();
  control = propio;
  set({ busqueda: { estado: "buscando" }, pagina: 1 });
  try {
    const resultado = await crearBusqueda(datos, propio.signal);
    if (!propio.signal.aborted) set({ busqueda: { estado: "lista", resultado } });
  } catch (err) {
    if (propio.signal.aborted) return;
    if (esFallaDeFuentes(err)) {
      set({
        busqueda: {
          estado: "error",
          titulo: err.message,
          detalles: Object.entries(err.details.porFuente)
            .filter(([, f]) => f?.error)
            .map(([n, f]) => `${n.toUpperCase()}: ${f.error}`),
        },
      });
    } else if (esAmbigua(err)) {
      set({
        busqueda: {
          estado: "error",
          titulo: err.message,
          detalles: err.details.candidatos.map((c) => `${c.nombre} (${c.departamento})`),
        },
      });
    } else {
      set({ busqueda: { estado: "error", titulo: "No se pudo completar la búsqueda.", detalles: [mensajeDeError(err)] } });
    }
  } finally {
    if (control === propio) control = null;
  }
}

export const busquedaStore = {
  get,
  getServer: () => VACIO,
  subscribe(fn: () => void) {
    oyentes.add(fn);
    return () => {
      oyentes.delete(fn);
    };
  },
  buscar,
  setForm: (cambios: Partial<FormBusqueda>) => set({ form: { ...get().form, ...cambios } }),
  setPagina: (pagina: number) => set({ pagina }),
};
