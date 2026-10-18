// Sesión del usuario (token + datos básicos). Se guarda en localStorage para no pedir login
// en cada recarga; si no está disponible (modo privado, prerender) queda solo en memoria.

export type Rol = "SERVICE" | "ADMIN";

export interface UsuarioSesion {
  id: number;
  email: string;
  fullName: string;
  rol: Rol;
}

export interface Sesion {
  token: string;
  usuario: UsuarioSesion;
}

const CLAVE = "leads_sesion";
const oyentes = new Set<() => void>();

let actual: Sesion | null | undefined;

function esSesion(v: unknown): v is Sesion {
  const s = v as Sesion | null;
  return Boolean(s && typeof s.token === "string" && s.usuario && typeof s.usuario.id === "number");
}

function leer(): Sesion | null {
  if (actual !== undefined) return actual;
  try {
    const crudo = globalThis.localStorage?.getItem(CLAVE);
    const valor: unknown = crudo ? JSON.parse(crudo) : null;
    actual = esSesion(valor) ? valor : null;
  } catch {
    actual = null;
  }
  return actual;
}

function guardar(valor: Sesion | null) {
  actual = valor;
  try {
    if (valor) globalThis.localStorage?.setItem(CLAVE, JSON.stringify(valor));
    else globalThis.localStorage?.removeItem(CLAVE);
  } catch {
    // sin persistencia: queda solo en memoria
  }
  oyentes.forEach((fn) => fn());
}

export const sessionStore = {
  get: leer,
  set: (valor: Sesion) => guardar(valor),
  clear: () => guardar(null),
  subscribe(fn: () => void) {
    oyentes.add(fn);
    return () => {
      oyentes.delete(fn);
    };
  },
};
