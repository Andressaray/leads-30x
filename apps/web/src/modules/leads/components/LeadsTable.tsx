import type { ReactNode } from "react";
import { Skeleton } from "@/shared/ui";
import type { Lead } from "../types";
import { LeadRow, type VarianteTabla } from "./LeadRow";

const BASE = ["Negocio", "NIT", "Contacto", "Dirección", "Fuentes"];
const COLUMNAS: Record<VarianteTabla, string[]> = {
  busqueda: [...BASE, "Estado"],
  contactados: [...BASE, "Contactado por", "Último contacto", "Estado"],
};

function Tabla({ children, variante = "busqueda" }: { children: ReactNode; variante?: VarianteTabla }) {
  return (
    <div className="tabla">
      <table>
        <thead>
          <tr>
            {COLUMNAS[variante].map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

interface LeadsTableProps {
  leads: Lead[];
  variante?: VarianteTabla;
  onAbrir: (id: number) => void;
}

export function LeadsTable({ leads, variante = "busqueda", onAbrir }: LeadsTableProps) {
  return (
    <Tabla variante={variante}>
      {leads.map((l) => (
        <LeadRow key={l.id} lead={l} variante={variante} onAbrir={onAbrir} />
      ))}
    </Tabla>
  );
}

const ANCHOS = ["72%", "58%", "84%", "66%", "77%", "61%", "88%", "70%", "63%", "80%"];

export function LeadsTableSkeleton({ filas = 6, variante = "busqueda" }: { filas?: number; variante?: VarianteTabla }) {
  return (
    <Tabla variante={variante}>
      {Array.from({ length: filas }, (_, i) => (
        <tr key={i}>
          <td><Skeleton width={ANCHOS[i % 10]} height={13} /></td>
          <td><Skeleton width="50%" height={13} /></td>
          <td><Skeleton width={ANCHOS[(i + 3) % 10]} height={13} /></td>
          <td><Skeleton width={ANCHOS[(i + 6) % 10]} height={13} /></td>
          <td><Skeleton chip /></td>
          <td><Skeleton chip /></td>
          {variante === "contactados" && <td><Skeleton width="70%" height={13} /></td>}
          {variante === "contactados" && <td><Skeleton chip /></td>}
        </tr>
      ))}
    </Tabla>
  );
}
