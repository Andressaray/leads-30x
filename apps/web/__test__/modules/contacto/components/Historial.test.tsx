import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Historial } from "@/modules/contacto/components/Historial";
import { interaccion } from "./ficha";

describe("Historial", () => {
  it("sin interacciones lo dice", () => {
    render(<Historial interacciones={[]} />);
    expect(screen.getByText("Todavía no hay mensajes ni llamadas con este lead.")).toBeInTheDocument();
  });

  it("titula cada interacción según canal, sentido y estado", () => {
    render(
      <Historial
        interacciones={[
          interaccion({ id: 1 }),
          interaccion({ id: 2, estado: "FALLIDO", error: "SMTP rechazó" }),
          interaccion({ id: 3, estado: "SIMULADO" }),
          interaccion({ id: 4, canal: "WHATSAPP" }),
          interaccion({ id: 5, canal: "DAPTA" }),
          interaccion({ id: 6, sentido: "ENTRANTE", canal: "WHATSAPP", resultado: "INTERESADO", nota: "Pide precios" }),
          interaccion({ id: 7, sentido: "ENTRANTE", canal: "DAPTA", resultado: "RESPONDIO" }),
          interaccion({ id: 8, sentido: "ENTRANTE", canal: "OTRO", resultado: null }),
        ]}
      />,
    );
    const titulos = screen.getAllByRole("listitem").map((li) => li.querySelector("b")?.textContent);
    expect(titulos).toEqual([
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
