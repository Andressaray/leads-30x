// Qué fuentes están activas. Vive solo en el navegador (localStorage): no se consulta
// ni se envía a la API. Si no hay almacenamiento disponible, queda en memoria.
import type { NombreFuente } from "@/modules/leads";
import { FICHAS_FUENTES } from "../fichas";

export type EstadoFuentes = Record<NombreFuente, boolean>;

const CLAVE = "leads_fuentes";
const TODAS: EstadoFuentes = Object.fromEntries(FICHAS_FUENTES.map((f) => [f.clave, true])) as EstadoFuentes;

const oyentes = new Set<() => void>();
let actual: EstadoFuentes | undefined;

function get(): EstadoFuentes {
  if (actual) return actual;
  actual = TODAS;
  try {
    const crudo = globalThis.localStorage?.getItem(CLAVE);
    const guardado = crudo ? (JSON.parse(crudo) as Partial<EstadoFuentes>) : {};
    actual = { ...TODAS };
    for (const f of FICHAS_FUENTES) if (typeof guardado[f.clave] === "boolean") actual[f.clave] = guardado[f.clave]!;
  } catch {
    // sin persistencia: todas activas
  }
  return actual;
}

function set(valor: EstadoFuentes) {
  actual = valor;
  try {
    globalThis.localStorage?.setItem(CLAVE, JSON.stringify(valor));
  } catch {
    // sin persistencia: queda en memoria mientras la pestaña siga abierta
  }
  oyentes.forEach((fn) => fn());
}

export const fuentesStore = {
  get,
  getServer: () => TODAS,
  subscribe(fn: () => void) {
    oyentes.add(fn);
    return () => {
      oyentes.delete(fn);
    };
  },
  alternar: (clave: NombreFuente) => set({ ...get(), [clave]: !get()[clave] }),
  todas: (activa: boolean) => set(Object.fromEntries(FICHAS_FUENTES.map((f) => [f.clave, activa])) as EstadoFuentes),
};
