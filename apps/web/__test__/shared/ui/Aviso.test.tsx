import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Aviso } from "@/shared/ui";

describe("Aviso", () => {
  it("un error se anuncia como alerta con sus detalles", () => {
    render(<Aviso tipo="error" titulo="Falló" detalles={["DANE: timeout", "OSM: 429"]} className="extra" />);
    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveClass("aviso", "aviso-error", "extra");
    expect(alerta).toHaveTextContent("Falló");
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["DANE: timeout", "OSM: 429"]);
  });

  it("un aviso informativo es un status, sin lista si no hay detalles", () => {
    render(
      <Aviso tipo="info" titulo="Buscando…">
        Puede tardar
      </Aviso>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Buscando…Puede tardar");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
