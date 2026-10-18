import type { ReactNode } from "react";
import { Skeleton } from "@/shared/ui";
import type { Lead } from "../types";
import { LeadRow, type TableVariant } from "./LeadRow";

const BASE = ["Negocio", "NIT", "Contacto", "Dirección", "Fuentes"];
const COLUMNS: Record<TableVariant, string[]> = {
  search: [...BASE, "Estado"],
  contacted: [...BASE, "Contactado por", "Último contacto", "Estado"],
};

function Table({ children, variant = "search" }: { children: ReactNode; variant?: TableVariant }) {
  return (
    <div className="table">
      <table>
        <thead>
          <tr>
            {COLUMNS[variant].map((c) => (
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
  variant?: TableVariant;
  onOpen: (id: number) => void;
}

export function LeadsTable({ leads, variant = "search", onOpen }: LeadsTableProps) {
  return (
    <Table variant={variant}>
      {leads.map((l) => (
        <LeadRow key={l.id} lead={l} variant={variant} onOpen={onOpen} />
      ))}
    </Table>
  );
}

const WIDTHS = ["72%", "58%", "84%", "66%", "77%", "61%", "88%", "70%", "63%", "80%"];

export function LeadsTableSkeleton({ rows = 6, variant = "search" }: { rows?: number; variant?: TableVariant }) {
  return (
    <Table variant={variant}>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i}>
          <td><Skeleton width={WIDTHS[i % 10]} height={13} /></td>
          <td><Skeleton width="50%" height={13} /></td>
          <td><Skeleton width={WIDTHS[(i + 3) % 10]} height={13} /></td>
          <td><Skeleton width={WIDTHS[(i + 6) % 10]} height={13} /></td>
          <td><Skeleton chip /></td>
          <td><Skeleton chip /></td>
          {variant === "contacted" && <td><Skeleton width="70%" height={13} /></td>}
          {variant === "contacted" && <td><Skeleton chip /></td>}
        </tr>
      ))}
    </Table>
  );
}
