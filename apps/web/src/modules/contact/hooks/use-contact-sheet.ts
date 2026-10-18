import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/shared/lib/http";
import { listTemplates, getContactSheet } from "../services/contact.service";
import type { ContactSheet, Template } from "../types";

type Status = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; sheet: ContactSheet };

/** Contact sheet of a lead (status, history, permissions) and the active templates. */
export function useContactSheet(leadId: number) {
  const [status, setStatus] = useState<Status>({ status: "loading" });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const control = new AbortController();
    getContactSheet(leadId, control.signal)
      .then((sheet) => setStatus({ status: "ready", sheet }))
      .catch((err: unknown) => !control.signal.aborted && setStatus({ status: "error", message: errorMessage(err) }));
    return () => control.abort();
  }, [leadId, version]);

  useEffect(() => {
    listTemplates().then(setTemplates, () => setTemplates([]));
  }, []);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...status, templates, reload } as Status & { templates: Template[]; reload: () => void };
}
