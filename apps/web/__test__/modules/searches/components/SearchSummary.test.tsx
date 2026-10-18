import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchSummary } from "@/modules/searches/components/SearchSummary";
import { searchResult } from "../../../helpers/fixtures";
import { failure, mockFetch } from "../../../helpers/http";

const datum = (label: string) => screen.getByText(label, { selector: ".stat span" }).previousElementSibling?.textContent;

describe("ResumenBusqueda", () => {
  const { createObjectURL, revokeObjectURL } = URL;
  afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  it("shows the city, the totals and the result of each source", () => {
    const r = searchResult();
    r.summary.bySource.rnt = { status: "skipped", records: 0, new: 0, enriched: 0, error: null };
    render(<SearchSummary result={r} />);

    expect(screen.getByText(/Medellín, Antioquia · Restaurantes · búsqueda #42/)).toBeInTheDocument();
    expect(datum("Leads")).toBe("120");
    expect(datum("Contactables")).toBe("80");
    expect(datum("En 2+ fuentes")).toBe("15");
    expect(datum("DANE")).toBe("70");
    expect(datum("RNT")).toBe("no aplica");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns which sources failed", () => {
    const r = searchResult();
    r.summary.bySource.secop = { status: "error", records: 0, new: 0, enriched: 0, error: "timeout" };
    r.summary.bySource.reps = { status: "error", records: 0, new: 0, enriched: 0, error: "HTTP 500" };
    render(<SearchSummary result={r} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("2 fuentes fallaron");
    expect(alert).toHaveTextContent("SECOP: timeout");
    expect(alert).toHaveTextContent("REPS: HTTP 500");
    expect(datum("SECOP")).toBe("error");
  });

  it("downloads the search CSV", async () => {
    mockFetch({ "/api/leads/export.csv": new Response("id,nombre\n1,A") });
    URL.createObjectURL = vi.fn(() => "blob:csv");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<SearchSummary result={searchResult()} />);
    await userEvent.click(screen.getByRole("button", { name: "Descargar CSV" }));

    await vi.waitFor(() => expect(click).toHaveBeenCalled());
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("leads-busqueda-42.csv");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/leads/export.csv?search=42");
  });

  it("if the CSV fails it says so", async () => {
    mockFetch({ "/api/leads/export.csv": failure(500, "No se pudo generar") });
    render(<SearchSummary result={searchResult()} />);
    await userEvent.click(screen.getByRole("button", { name: "Descargar CSV" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo descargar el CSV.No se pudo generar");
  });
});
