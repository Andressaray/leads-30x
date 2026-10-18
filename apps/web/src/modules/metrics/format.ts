import type { CostChannel } from "./types";

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export const weights = (n: number | null | undefined) => (n === null || n === undefined ? "—" : COP.format(n));
export const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Math.round(n * 100)} %`);
export const integer = (n: number) => n.toLocaleString("es-CO");

export const COST_CHANNEL_NAME: Record<CostChannel, string> = {
  dane: "DANE",
  osm: "OpenStreetMap",
  rnt: "RNT",
  secop: "SECOP II",
  reps: "REPS",
  email: "Correo",
  whatsapp: "WhatsApp",
  call: "Llamadas",
  dapta: "Dapta",
  general: "General",
};

/** Today's YYYY-MM-DD date in Colombia. */
export function todayColombia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Quick periods (in Colombian dates). */
export function period(preset: "month" | "last-month" | "90"): { from: string; to: string } {
  const today = todayColombia();
  const [a, m] = today.split("-").map(Number);
  if (preset === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  if (preset === "last-month") {
    const start = new Date(Date.UTC(a, m - 2, 1));
    const end = new Date(Date.UTC(a, m - 1, 0));
    return { from: ymd(start), to: ymd(end) };
  }
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - 89 * 86_400_000);
  return { from: ymd(from), to: today };
}

export const shortDate = (s: string) =>
  new Date(`${s}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
