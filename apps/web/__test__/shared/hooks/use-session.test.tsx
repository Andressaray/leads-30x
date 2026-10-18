import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSesion } from "@/shared/hooks/use-session";
import { sessionStore } from "@/shared/lib/session-store";
import { sesion } from "../../helpers/fixtures";

describe("useSesion", () => {
  it("se actualiza al iniciar y cerrar sesión", () => {
    const { result } = renderHook(() => useSesion());
    expect(result.current).toBeNull();

    act(() => sessionStore.set(sesion()));
    expect(result.current?.usuario.fullName).toBe("Andrés Saray");

    act(() => sessionStore.clear());
    expect(result.current).toBeNull();
  });
});
