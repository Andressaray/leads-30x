import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QualityChip, StatusChip } from "@/modules/contact";

describe("EstadoChip", () => {
  it.each([
    ["CONTACTED", "Sin respuesta", "status-contacted"],
    ["NOT_INTERESTED", "No interesado", "status-not-interested"],
    ["INTERESTED", "Interesado", "status-interested"],
  ] as const)("%s → %s", (status, text, className) => {
    render(<StatusChip status={status} />);
    expect(screen.getByText(text)).toHaveClass("status-chip", className);
  });

  it("'do not contact' takes priority over the status", () => {
    render(<StatusChip status="INTERESTED" doNotContact />);
    expect(screen.getByText("No contactar")).toHaveClass("status-blocked");
  });
});

describe("CalidadChip", () => {
  it("shows the quality with its score", () => {
    render(<QualityChip quality="HIGH" score={87} />);
    const chip = screen.getByText("Calidad alta");
    expect(chip).toHaveClass("quality-chip", "quality-high");
    expect(chip).toHaveAttribute("title", "Puntaje 87 de 100");
    expect(chip).toHaveTextContent("Calidad alta87");
  });

  it("a score of 0 is also shown; without a score, it is not", () => {
    const { rerender } = render(<QualityChip quality="LOW" score={0} />);
    expect(screen.getByText("Calidad baja")).toHaveAttribute("title", "Puntaje 0 de 100");
    rerender(<QualityChip quality="DISCARDED" score={null} />);
    expect(screen.getByText("Descartado")).not.toHaveAttribute("title");
  });
});
