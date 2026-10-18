import { useState } from "react";
import { ContactPanel } from "@/modules/contact";
import { DaptaDispatch } from "./DaptaDispatch";
import { Notice } from "@/shared/ui";
import { useLeads } from "../hooks/use-leads";
import type { LeadFilters } from "../types";
import type { TableVariant } from "./LeadRow";
import { LeadsTable, LeadsTableSkeleton } from "./LeadsTable";
import { Paginator } from "./Paginator";

/** Paginated leads table with its loading, error and empty states. */
interface LeadsPanelProps {
  filters: LeadFilters;
  variant?: TableVariant;
  /** Text when there are no leads. */
  empty?: string;
  /** Page controlled from outside; without a value, the table manages it on its own. */
  page?: number;
  onPageChange?: (page: number) => void;
  /** Shows the button to send the page's leads to Dapta. */
  daptaDispatch?: boolean;
}

export function LeadsPanel({
  filters,
  variant = "search",
  empty = "No hay leads para mostrar todavía.",
  page,
  onPageChange,
  daptaDispatch = false,
}: LeadsPanelProps) {
  const { loading, data, error, setPage, reload } = useLeads(filters, { page, onPageChange });
  // Lead with the contact panel open.
  const [isOpen, setIsOpen] = useState<number | null>(null);

  return (
    <>
      {error && (
        <div className="status">
          <Notice type="error" title="No se pudieron cargar los leads." details={[error]} />
        </div>
      )}
      {/* Fuera del "cargando": así el resultado del envío sigue a la vista mientras la tabla se refresca. */}
      {daptaDispatch && data && data.leads.length > 0 && <DaptaDispatch leads={data.leads} onSent={reload} />}
      {loading && <LeadsTableSkeleton variant={variant} rows={Math.min(data?.leads.length || 6, 10)} />}
      {!loading && data && data.leads.length === 0 && <p className="empty">{empty}</p>}
      {!loading && data && data.leads.length > 0 && (
        <>
          <LeadsTable leads={data.leads} variant={variant} onOpen={setIsOpen} />
          <Paginator total={data.total} page={data.page} limit={data.limit} onChange={setPage} />
        </>
      )}
      {isOpen !== null && (
        <ContactPanel
          leadId={isOpen}
          onClose={(hasChanges) => {
            setIsOpen(null);
            if (hasChanges) reload();
          }}
        />
      )}
    </>
  );
}
