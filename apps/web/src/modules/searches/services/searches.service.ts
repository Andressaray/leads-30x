import { ApiError, http } from "@/shared/lib/http";
import type { SavedSearch, CreateSearch, SearchStart, SearchResult } from "../types";

const INTERVAL_MS = 2000;
/** More than the API's worst case (every source with its wait limit) plus some queue time. */
const MAX_WAIT_MS = 10 * 60 * 1000;

const pause = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });

function toResult(b: SavedSearch): SearchResult {
  const summary = b.summary ?? { leads: 0, new: 0, contactables: 0, inMultipleSources: 0, bySource: {} };
  return {
    searchId: b.id,
    status: b.status,
    municipality: { code: b.municipalityCode, name: b.municipality, department: b.department },
    filters: b.filters,
    summary,
    leadsTotal: summary.leads,
    leads: [],
  };
}

/**
 * Starts the search in the five sources. The API responds right away (202) and
 * processes it in the background; here its status is polled until it finishes.
 */
export async function createSearch(data: CreateSearch, signal?: AbortSignal): Promise<SearchResult> {
  const start = await http.post<SearchStart>("/api/searches", { ...data, async: true });
  const limit = Date.now() + MAX_WAIT_MS;

  for (;;) {
    await pause(INTERVAL_MS, signal);
    const b = await http.get<SavedSearch>(`/api/searches/${start.searchId}`, undefined, signal);
    if (b.status === "failed") {
      const bySource = b.summary?.bySource ?? {};
      throw new ApiError(502, "Ninguna fuente respondió. Intenta de nuevo en unos minutos.", { bySource });
    }
    if (b.status !== "in_progress") return toResult(b);
    if (Date.now() > limit) {
      throw new ApiError(504, `La búsqueda #${start.searchId} sigue en curso. Revísala más tarde en el historial.`);
    }
  }
}
