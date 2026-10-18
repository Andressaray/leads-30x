import { http } from "@/shared/lib/http";
import { sessionStore } from "@/shared/lib/session-store";
import type { Credentials, Member, Role, Session } from "../types";

/** Logs in and keeps the session stored in the browser. */
export async function login(data: Credentials): Promise<Session> {
  const session = await http.post<Session>("/api/auth/login", data);
  sessionStore.set(session);
  return session;
}

export function logout(): void {
  sessionStore.clear();
}

/** Team members (no administrators) with how many leads each one contacted. */
export function listMembers(signal?: AbortSignal): Promise<Member[]> {
  return http.get<Member[]>("/api/users/members", undefined, signal);
}

export const ROLE_NAME: Record<Role, string> = { SERVICE: "Servicio", ADMIN: "Administrador" };

/** Only accepts internal routes to return to after login (prevents redirects to other sites). */
export function safePath(destination: string | null): string {
  return destination && destination.startsWith("/") && !destination.startsWith("//") && !destination.startsWith("/login") ? destination : "/";
}
