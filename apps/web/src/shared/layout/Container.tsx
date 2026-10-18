import type { ReactNode } from "react";

export function Container({ children }: { children: ReactNode }) {
  return <main className="container">{children}</main>;
}
