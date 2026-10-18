import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { iniciales } from "@/shared/lib/iniciales";

interface AvatarProps {
  /** Nombre de la persona (se muestran sus iniciales). */
  nombre?: string;
  /** Contenido propio en lugar de iniciales (p. ej. un ícono). */
  children?: ReactNode;
  tamano?: "sm" | "md";
  variante?: "persona" | "neutro";
}

export function Avatar({ nombre = "", children, tamano = "md", variante = "persona" }: AvatarProps) {
  return (
    <span className={cn("avatar", tamano === "sm" && "avatar-sm", variante === "neutro" && "avatar-neutro")} aria-hidden="true">
      {children ?? iniciales(nombre)}
    </span>
  );
}
