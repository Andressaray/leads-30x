import type { CSSProperties } from "react";
import { cn } from "@/shared/lib/cn";

interface SkeletonProps {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  chip?: boolean;
  style?: CSSProperties;
}

export function Skeleton({ width, height, chip, style }: SkeletonProps) {
  return <span className={cn("skeleton", chip && "skeleton-chip")} style={{ width, height, ...style }} />;
}
