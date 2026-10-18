import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/shared/lib/http";
import { listLeads } from "../services/leads.service";
import type { LeadFilters, LeadList } from "../types";

interface Reply {
  key: string;
  data: LeadList | null;
  error: string | null;
}

interface PageOptions {
  /** Page controlled from outside (to keep it when changing sections). Without a value, the hook manages it. */
  page?: number;
  onPageChange?: (page: number) => void;
}

/** Paginated leads table for some filters; reload() requests it again (after contacting a lead). */
export function useLeads(filters: LeadFilters, { page: externalPage, onPageChange }: PageOptions = {}) {
  const filtersKey = JSON.stringify(filters);
  // The page is stored next to its filters: if they change, it goes back to 1 without an extra effect.
  const [pageOf, setPageOf] = useState({ filters: filtersKey, page: 1 });
  const internalPage = pageOf.filters === filtersKey ? pageOf.page : 1;
  const page = externalPage ?? internalPage;
  const [reloadKey, setReloadKey] = useState(0);
  const [response, setReply] = useState<Reply | null>(null);

  const key = `${filtersKey}|${page}|${reloadKey}`;

  useEffect(() => {
    const control = new AbortController();
    listLeads(JSON.parse(filtersKey) as LeadFilters, page, control.signal)
      .then((data) => setReply({ key, data, error: null }))
      .catch((err: unknown) => {
        if (!control.signal.aborted) setReply({ key, data: null, error: errorMessage(err) });
      });
    return () => control.abort();
  }, [key, filtersKey, page]);

  const setPage = useCallback(
    (p: number) => (onPageChange ? onPageChange(p) : setPageOf({ filters: filtersKey, page: p })),
    [filtersKey, onPageChange],
  );

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  const loading = response?.key !== key;
  return {
    loading,
    // While loading, the previous data is kept (it is used to size the skeleton).
    data: response?.data ?? null,
    error: loading ? null : (response?.error ?? null),
    page,
    setPage,
    reload,
  };
}
