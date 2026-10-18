import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalidadChip, EstadoChip } from "@/modules/contacto";

describe("EstadoChip", () => {
  it.each([
    ["CONTACTADO", "Sin respuesta", "estado-contactado"],
    ["NO_INTERESADO", "No interesado", "estado-no-interesado"],
    ["INTERESADO", "Interesado", "estado-interesado"],
  ] as const)("%s → %s", (estado, texto, clase) => {
    render(<EstadoChip estado={estado} />);
    expect(screen.getByText(texto)).toHaveClass("estado-chip", clase);
  });

  it("'no contactar' tiene prioridad sobre el estado", () => {
    render(<EstadoChip estado="INTERESADO" noContactar />);
    expect(screen.getByText("No contactar")).toHaveClass("estado-bloqueado");
  });
});

describe("CalidadChip", () => {
  it("muestra la calidad con su puntaje", () => {
    render(<CalidadChip calidad="ALTA" puntaje={87} />);
    const chip = screen.getByText("Calidad alta");
    expect(chip).toHaveClass("calidad-chip", "calidad-alta");
    expect(chip).toHaveAttribute("title", "Puntaje 87 de 100");
    expect(chip).toHaveTextContent("Calidad alta87");
  });

  it("un puntaje 0 también se muestra; sin puntaje, no", () => {
    const { rerender } = render(<CalidadChip calidad="BAJA" puntaje={0} />);
    expect(screen.getByText("Calidad baja")).toHaveAttribute("title", "Puntaje 0 de 100");
    rerender(<CalidadChip calidad="DESCARTADO" puntaje={null} />);
    expect(screen.getByText("Descartado")).not.toHaveAttribute("title");
  });
});
