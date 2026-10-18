import type { MetaDescriptor } from "react-router";

export const SITE_NAME = "Leads Colombia";
export const SITE_URL = import.meta.env.VITE_SITE_URL ?? "";

interface MetaOpciones {
  title?: string;
  description?: string;
  /** Herramienta interna: por defecto no se indexa. */
  noindex?: boolean;
}

export function buildMeta({ title, description, noindex = true }: MetaOpciones = {}): MetaDescriptor[] {
  return [
    { title: title ? `${title} · ${SITE_NAME}` : SITE_NAME },
    ...(description ? [{ name: "description", content: description }] : []),
    ...(noindex ? [{ name: "robots", content: "noindex, nofollow" }] : []),
  ];
}
