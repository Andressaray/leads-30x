import type { MetaDescriptor } from "react-router";

export const SITE_NAME = "Leads Colombia";
export const SITE_URL = import.meta.env.VITE_SITE_URL ?? "";

interface MetaOptions {
  title?: string;
  description?: string;
  /** Internal tool: not indexed by default. */
  noindex?: boolean;
}

export function buildMeta({ title, description, noindex = true }: MetaOptions = {}): MetaDescriptor[] {
  return [
    { title: title ? `${title} · ${SITE_NAME}` : SITE_NAME },
    ...(description ? [{ name: "description", content: description }] : []),
    ...(noindex ? [{ name: "robots", content: "noindex, nofollow" }] : []),
  ];
}
