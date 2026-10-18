import { cn } from "@/shared/lib/cn";
import { NOMBRE_ESTADO } from "../estados";
import type { EstadoContacto } from "../types";

/** Estado del lead en el embudo, con color según qué tan bien va. */
export function EstadoChip({ estado, noContactar }: { estado: EstadoContacto; noContactar?: boolean }) {
  if (noContactar) return <span className="estado-chip estado-bloqueado">No contactar</span>;
  return <span className={cn("estado-chip", `estado-${estado.toLowerCase().replace("_", "-")}`)}>{NOMBRE_ESTADO[estado]}</span>;
}
