import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSession } from "@/shared/hooks/use-session";
import { sessionStore } from "@/shared/lib/session-store";
import { session } from "../../helpers/fixtures";

describe("useSession", () => {
  it("updates on login and logout", () => {
    const { result } = renderHook(() => useSession());
    expect(result.current).toBeNull();

    act(() => sessionStore.set(session()));
    expect(result.current?.user.fullName).toBe("Andrés Saray");

    act(() => sessionStore.clear());
    expect(result.current).toBeNull();
  });
});
