import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLeads } from "@/modules/leads/hooks/use-leads";
import type { LeadFilters } from "@/modules/leads";
import { lead } from "../../../helpers/fixtures";
import { failure, mockFetch, ok } from "../../../helpers/http";

/** Leads API that responds with the requested page. */
function apiLeads() {
  return mockFetch({
    "/api/leads": (url) => ok({ total: 45, page: Number(url.searchParams.get("page")), limit: 20, leads: [lead()] }),
  });
}

const query = (f: ReturnType<typeof mockFetch>, i: number) => Object.fromEntries(new URL(String(f.mock.calls[i][0]), "http://x").searchParams);

describe("useLeads", () => {
  it("requests page 1 with the filters and the table limit", async () => {
    const f = apiLeads();
    const { result } = renderHook(() => useLeads({ search: 42, contactable: true }));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.total).toBe(45);
    expect(result.current.error).toBeNull();
    expect(query(f, 0)).toEqual({ search: "42", contactable: "true", page: "1", limit: "20" });
  });

  it("changing the page requests it and, when the filters change, goes back to 1", async () => {
    const f = apiLeads();
    const { result, rerender } = renderHook(({ filters }: { filters: LeadFilters }) => useLeads(filters), {
      initialProps: { filters: { search: 1 } },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.data?.page).toBe(3));
    expect(result.current.page).toBe(3);

    rerender({ filters: { search: 2 } });
    expect(result.current.page).toBe(1);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(query(f, f.mock.calls.length - 1)).toMatchObject({ search: "2", page: "1" });
  });

  it("with a page controlled from outside it reports the change instead of storing it", async () => {
    apiLeads();
    const onPageChange = vi.fn();
    const { result } = renderHook(() => useLeads({}, { page: 2, onPageChange }));
    await waitFor(() => expect(result.current.data?.page).toBe(2));
    act(() => result.current.setPage(3));
    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(result.current.page).toBe(2);
  });

  it("reload requests again and keeps the data while loading", async () => {
    const f = apiLeads();
    const { result } = renderHook(() => useLeads({}));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.reload());
    expect(result.current.loading).toBe(true);
    expect(result.current.data).not.toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("exposes the API error", async () => {
    mockFetch({ "/api/leads": failure(500, "Base caída") });
    const { result } = renderHook(() => useLeads({}));
    await waitFor(() => expect(result.current.error).toBe("Base caída"));
    expect(result.current.data).toBeNull();
  });
});
