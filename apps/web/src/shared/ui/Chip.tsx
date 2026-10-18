import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export function Chip({ children, ok }: { children: ReactNode; ok?: boolean }) {
  return <span className={cn("chip", ok && "chip-ok")}>{children}</span>;
}
