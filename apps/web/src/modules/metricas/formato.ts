import type { CanalCosto } from "./types";

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export const pesos = (n: number | null | undefined) => (n === null || n === undefined ? "—" : COP.format(n));
export const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Math.round(n * 100)} %`);
export const entero = (n: number) => n.toLocaleString("es-CO");

export const NOMBRE_CANAL_COSTO: Record<CanalCosto, string> = {
  dane: "DANE",
  osm: "OpenStreetMap",
  rnt: "RNT",
  secop: "SECOP II",
  reps: "REPS",
  email: "Correo",
  whatsapp: "WhatsApp",
  llamada: "Llamadas",
  dapta: "Dapta",
  general: "General",
};

/** Fecha AAAA-MM-DD de hoy en Colombia. */
export function hoyColombia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Periodos rápidos (en fechas de Colombia). */
export function periodo(preset: "mes" | "mes-pasado" | "90"): { desde: string; hasta: string } {
  const hoy = hoyColombia();
  const [a, m] = hoy.split("-").map(Number);
  if (preset === "mes") return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
  if (preset === "mes-pasado") {
    const inicio = new Date(Date.UTC(a, m - 2, 1));
    const fin = new Date(Date.UTC(a, m - 1, 0));
    return { desde: ymd(inicio), hasta: ymd(fin) };
  }
  const desde = new Date(Date.parse(`${hoy}T00:00:00Z`) - 89 * 86_400_000);
  return { desde: ymd(desde), hasta: hoy };
}

export const fechaCorta = (s: string) =>
  new Date(`${s}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
