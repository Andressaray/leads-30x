import { cn } from "@/shared/lib/cn";
import { STATUS_NAME } from "../statuses";
import type { ContactStatus } from "../types";

/** Lead status in the funnel, colored by how well it is going. */
export function StatusChip({ status, doNotContact }: { status: ContactStatus; doNotContact?: boolean }) {
  if (doNotContact) return <span className="status-chip status-blocked">No contactar</span>;
  return <span className={cn("status-chip", `status-${status.toLowerCase().replace("_", "-")}`)}>{STATUS_NAME[status]}</span>;
}
