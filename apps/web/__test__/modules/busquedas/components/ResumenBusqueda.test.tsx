import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResumenBusqueda } from "@/modules/busquedas/components/ResumenBusqueda";
import { resultadoBusqueda } from "../../../helpers/fixtures";
import { falla, mockFetch } from "../../../helpers/http";

const dato = (etiqueta: string) => screen.getByText(etiqueta, { selector: ".dato span" }).previousElementSibling?.textContent;

describe("ResumenBusqueda", () => {
  const { createObjectURL, revokeObjectURL } = URL;
  afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  it("muestra la ciudad, los totales y el resultado de cada fuente", () => {
    const r = resultadoBusqueda();
    r.resumen.porFuente.rnt = { estado: "omitida", registros: 0, nuevos: 0, enriquecidos: 0, error: null };
    render(<ResumenBusqueda resultado={r} />);

    expect(screen.getByText(/Medellín, Antioquia · Restaurantes · búsqueda #42/)).toBeInTheDocument();
    expect(dato("Leads")).toBe("120");
    expect(dato("Contactables")).toBe("80");
    expect(dato("En 2+ fuentes")).toBe("15");
    expect(dato("DANE")).toBe("70");
    expect(dato("RNT")).toBe("no aplica");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("avisa qué fuentes fallaron", () => {
    const r = resultadoBusqueda();
    r.resumen.porFuente.secop = { estado: "error", registros: 0, nuevos: 0, enriquecidos: 0, error: "timeout" };
    r.resumen.porFuente.reps = { estado: "error", registros: 0, nuevos: 0, enriquecidos: 0, error: "HTTP 500" };
    render(<ResumenBusqueda resultado={r} />);

    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent("2 fuentes fallaron");
    expect(alerta).toHaveTextContent("SECOP: timeout");
    expect(alerta).toHaveTextContent("REPS: HTTP 500");
    expect(dato("SECOP")).toBe("error");
  });

  it("descarga el CSV de la búsqueda", async () => {
    mockFetch({ "/api/leads/export.csv": new Response("id,nombre\n1,A") });
    URL.createObjectURL = vi.fn(() => "blob:csv");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<ResumenBusqueda resultado={resultadoBusqueda()} />);
    await userEvent.click(screen.getByRole("button", { name: "Descargar CSV" }));

    await vi.waitFor(() => expect(click).toHaveBeenCalled());
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("leads-busqueda-42.csv");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/leads/export.csv?busqueda=42");
  });

  it("si el CSV falla lo dice", async () => {
    mockFetch({ "/api/leads/export.csv": falla(500, "No se pudo generar") });
    render(<ResumenBusqueda resultado={resultadoBusqueda()} />);
    await userEvent.click(screen.getByRole("button", { name: "Descargar CSV" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo descargar el CSV.No se pudo generar");
  });
});
