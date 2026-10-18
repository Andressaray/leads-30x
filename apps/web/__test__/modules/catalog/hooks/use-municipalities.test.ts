import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { failure, mockFetch, ok } from "../../../helpers/http";

const MEDELLIN = { code: "05001", name: "Medellín", department: "Antioquia", departmentCode: "05" };

async function hook() {
  vi.resetModules();
  return (await import("@/modules/catalog")).useMunicipalities;
}

describe("useMunicipalities", () => {
  it("without a department it requests nothing", async () => {
    const f = mockFetch();
    const useMunicipalities = await hook();
    const { result } = renderHook(() => useMunicipalities(""));
    expect(result.current).toEqual({ status: "no-department" });
    expect(f).not.toHaveBeenCalled();
  });

  it("goes from loading to ready and reloads when the department changes", async () => {
    mockFetch({ "/api/catalog/municipalities": (url) => ok(url.searchParams.get("department") === "05" ? [MEDELLIN] : []) });
    const useMunicipalities = await hook();
    const { result, rerender } = renderHook(({ dep }) => useMunicipalities(dep), { initialProps: { dep: "05" } });

    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => expect(result.current).toEqual({ status: "ready", municipalities: [MEDELLIN] }));

    rerender({ dep: "08" });
    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => expect(result.current).toEqual({ status: "ready", municipalities: [] }));
  });

  it("ends up in error if the API fails", async () => {
    mockFetch({ "/api/catalog/municipalities": failure(500, "caída") });
    const useMunicipalities = await hook();
    const { result } = renderHook(() => useMunicipalities("05"));
    await waitFor(() => expect(result.current).toEqual({ status: "error" }));
  });
});
