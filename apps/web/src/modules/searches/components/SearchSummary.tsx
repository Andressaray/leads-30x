import { useState } from "react";
import { useSources } from "@/modules/sources";
import { downloadSearchCsv } from "@/modules/leads";
import { errorMessage } from "@/shared/lib/http";
import { Notice, Skeleton } from "@/shared/ui";
import type { SearchResult } from "../types";

export function SearchSummary({ result }: { result: SearchResult }) {
  const { summary: s, municipality, filters, searchId } = result;
  const [errorCsv, setErrorCsv] = useState<string | null>(null);
  const { status: active } = useSources();
  // Only the sources turned on in "Fuentes".
  const sources = Object.entries(s.bySource).filter(([n]) => active[n as keyof typeof active] !== false);
  const errors = sources.filter(([, f]) => f?.status === "error");

  const data: Array<[string, string | number]> = [
    ["Leads", s.leads],
    ["Nuevos", s.new],
    ["Contactables", s.contactables],
    ["En 2+ fuentes", s.inMultipleSources],
    ...sources.map(([n, f]): [string, string | number] => [
      n.toUpperCase(),
      f?.status === "ok" ? f.records : f?.status === "skipped" ? "no aplica" : "error",
    ]),
  ];

  return (
    <>
      <div className="status">
        <p style={{ margin: 0 }}>
          {municipality.name}, {municipality.department} · {filters.name} · búsqueda #{searchId} ·{" "}
          <button
            type="button"
            className="btn-link"
            onClick={() => downloadSearchCsv(searchId).catch((err) => setErrorCsv(errorMessage(err)))}
          >
            Descargar CSV
          </button>
        </p>
        {errors.length > 0 && (
          <Notice
            type="error"
            className="notice-compact"
            title={errors.length === 1 ? "Una fuente falló" : `${errors.length} fuentes fallaron`}
            details={errors.map(([n, f]) => `${n.toUpperCase()}: ${f?.error ?? ""}`)}
          />
        )}
        {errorCsv && <Notice type="error" className="notice-compact" title="No se pudo descargar el CSV." details={[errorCsv]} />}
      </div>
      <div className="summary">
        {data.map(([k, v]) => (
          <div className="stat" key={k}>
            <b>{v}</b>
            <span>{k}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function SummarySkeleton({ n = 6 }: { n?: number }) {
  return (
    <div className="summary">
      {Array.from({ length: n }, (_, i) => (
        <div className="stat" key={i}>
          <Skeleton width={38} height={21} style={{ marginBottom: 6 }} />
          <Skeleton width={64} height={10} />
        </div>
      ))}
    </div>
  );
}
