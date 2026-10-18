import { useEffect, useState } from "react";
import { getMunicipalities } from "../services/catalog.service";
import type { Municipality } from "../types";

export type MunicipalitiesState =
  | { status: "no-department" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; municipalities: Municipality[] };

type Reply = { department: string; municipalities: Municipality[] | null };

/** Municipalities of the selected department; reloaded every time it changes. */
export function useMunicipalities(departmentCode: string): MunicipalitiesState {
  const [response, setReply] = useState<Reply | null>(null);

  useEffect(() => {
    if (!departmentCode) return;
    const control = new AbortController();
    getMunicipalities(departmentCode, control.signal)
      .then((municipalities) => setReply({ department: departmentCode, municipalities }))
      .catch(() => {
        if (!control.signal.aborted) setReply({ department: departmentCode, municipalities: null });
      });
    return () => control.abort();
  }, [departmentCode]);

  if (!departmentCode) return { status: "no-department" };
  if (response?.department !== departmentCode) return { status: "loading" };
  return response.municipalities ? { status: "ready", municipalities: response.municipalities } : { status: "error" };
}
