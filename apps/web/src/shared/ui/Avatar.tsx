import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { initials } from "@/shared/lib/initials";

interface AvatarProps {
  /** The person's name (their initials are shown). */
  name?: string;
  /** Custom content instead of initials (e.g. an icon). */
  children?: ReactNode;
  size?: "sm" | "md";
  variant?: "person" | "neutral";
}

export function Avatar({ name = "", children, size = "md", variant = "person" }: AvatarProps) {
  return (
    <span className={cn("avatar", size === "sm" && "avatar-sm", variant === "neutral" && "avatar-neutral")} aria-hidden="true">
      {children ?? initials(name)}
    </span>
  );
}
