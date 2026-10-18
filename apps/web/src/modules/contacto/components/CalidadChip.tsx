import { NOMBRE_CALIDAD } from "../estados";
import type { CalidadLead } from "../types";

/** Calidad del lead según la última calificación (Dapta o manual). */
export function CalidadChip({ calidad, puntaje }: { calidad: CalidadLead; puntaje?: number | null }) {
  return (
    <span className={`calidad-chip calidad-${calidad.toLowerCase()}`} title={puntaje !== null && puntaje !== undefined ? `Puntaje ${puntaje} de 100` : undefined}>
      {NOMBRE_CALIDAD[calidad]}
      {puntaje !== null && puntaje !== undefined && <span className="calidad-puntaje">{puntaje}</span>}
    </span>
  );
}
