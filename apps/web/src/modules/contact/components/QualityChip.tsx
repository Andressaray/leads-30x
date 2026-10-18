import { QUALITY_NAME } from "../statuses";
import type { LeadQuality } from "../types";

/** Lead quality according to the latest qualification (Dapta or manual). */
export function QualityChip({ quality, score }: { quality: LeadQuality; score?: number | null }) {
  return (
    <span className={`quality-chip quality-${quality.toLowerCase()}`} title={score !== null && score !== undefined ? `Puntaje ${score} de 100` : undefined}>
      {QUALITY_NAME[quality]}
      {score !== null && score !== undefined && <span className="quality-score">{score}</span>}
    </span>
  );
}
