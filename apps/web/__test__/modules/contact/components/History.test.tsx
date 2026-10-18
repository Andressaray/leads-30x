import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { History } from "@/modules/contact/components/History";
import { interaction } from "./sheet";

describe("History", () => {
  it("without interactions it says so", () => {
    render(<History interactions={[]} />);
    expect(screen.getByText("Todavía no hay mensajes ni llamadas con este lead.")).toBeInTheDocument();
  });

  it("titles each interaction by channel, direction and status", () => {
    render(
      <History
        interactions={[
          interaction({ id: 1 }),
          interaction({ id: 2, status: "FAILED", error: "SMTP rechazó" }),
          interaction({ id: 3, status: "SIMULATED" }),
          interaction({ id: 4, channel: "WHATSAPP" }),
          interaction({ id: 5, channel: "DAPTA" }),
          interaction({ id: 6, direction: "INBOUND", channel: "WHATSAPP", result: "INTERESTED", note: "Pide precios" }),
          interaction({ id: 7, direction: "INBOUND", channel: "DAPTA", result: "REPLIED" }),
          interaction({ id: 8, direction: "INBOUND", channel: "OTHER", result: null }),
        ]}
      />,
    );
    const titles = screen.getAllByRole("listitem").map((li) => li.querySelector("b")?.textContent);
    expect(titles).toEqual([
      "Correo enviado",
      "Correo que no salió",
      "Correo enviado",
      "WhatsApp",
      "Llamada del agente de Dapta",
      "Respuesta por whatsapp",
      "Habló con el agente de Dapta",
      "Pidió no ser contactado",
    ]);
    expect(screen.getByText("Falló")).toBeInTheDocument();
    expect(screen.getByText("SMTP rechazó")).toBeInTheDocument();
    expect(screen.getByText("Simulado")).toBeInTheDocument();
    expect(screen.getByText("Interesado")).toBeInTheDocument();
    expect(screen.getByText("Pide precios")).toBeInTheDocument();
  });
});
