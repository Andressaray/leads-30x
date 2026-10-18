import { useEffect, useState } from "react";
import { errorMessage } from "@/shared/lib/http";
import { listMembers } from "../services/auth.service";
import type { Member } from "../types";

export type MembersState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; members: Member[] };

/** Team members (no administrators). Requested on mount, so the counts are up to date. */
export function useMembers(): MembersState {
  const [status, setStatus] = useState<MembersState>({ status: "loading" });

  useEffect(() => {
    const control = new AbortController();
    listMembers(control.signal)
      .then((members) => setStatus({ status: "ready", members }))
      .catch((err: unknown) => {
        if (!control.signal.aborted) setStatus({ status: "error", message: errorMessage(err) });
      });
    return () => control.abort();
  }, []);

  return status;
}
