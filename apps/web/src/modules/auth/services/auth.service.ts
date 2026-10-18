import { http } from "@/shared/lib/http";
import { sessionStore } from "@/shared/lib/session-store";
import type { Credenciales, Miembro, Rol, Sesion } from "../types";

/** Inicia sesión y la deja guardada en el navegador. */
export async function iniciarSesion(datos: Credenciales): Promise<Sesion> {
  const sesion = await http.post<Sesion>("/api/auth/login", datos);
  sessionStore.set(sesion);
  return sesion;
}

export function cerrarSesion(): void {
  sessionStore.clear();
}

/** Miembros del equipo (sin administradores) con cuántos leads contactó cada uno. */
export function listarMiembros(signal?: AbortSignal): Promise<Miembro[]> {
  return http.get<Miembro[]>("/api/usuarios/miembros", undefined, signal);
}

export const NOMBRE_ROL: Record<Rol, string> = { SERVICE: "Servicio", ADMIN: "Administrador" };

/** Solo acepta rutas internas para volver después del login (evita redirecciones a otros sitios). */
export function rutaSegura(destino: string | null): string {
  return destino && destino.startsWith("/") && !destino.startsWith("//") && !destino.startsWith("/login") ? destino : "/";
}
