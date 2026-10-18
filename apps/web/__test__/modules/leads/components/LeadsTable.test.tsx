import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LeadsTable } from "@/modules/leads/components/LeadsTable";
import { sessionStore } from "@/shared/lib/session-store";
import { lead, sesion } from "../../../helpers/fixtures";

const encabezados = () => screen.getAllByRole("columnheader").map((th) => th.textContent);
const fila = (nombre: string) => screen.getByRole("row", { name: new RegExp(nombre) });

describe("LeadsTable", () => {
  it("las columnas cambian según la variante", () => {
    const { rerender } = render(<LeadsTable leads={[]} onAbrir={vi.fn()} />);
    expect(encabezados()).toEqual(["Negocio", "NIT", "Contacto", "Dirección", "Fuentes", "Estado"]);
    rerender(<LeadsTable leads={[]} variante="contactados" onAbrir={vi.fn()} />);
    expect(encabezados()).toEqual(["Negocio", "NIT", "Contacto", "Dirección", "Fuentes", "Contactado por", "Último contacto", "Estado"]);
  });

  it("muestra los datos de contacto y enlaces seguros", () => {
    render(
      <LeadsTable
        onAbrir={vi.fn()}
        leads={[
          lead({
            nombre: "Café Andino",
            razonSocial: "Andino SAS",
            nit: "900123456",
            telefonos: [{ numero: "3001234567", tipo: "movil", whatsapp: true }],
            emails: ["hola@andino.co"],
            sitiosWeb: ["www.andino.co"],
            redes: ["https://www.instagram.com/cafeandino"],
            fuentes: ["dane", "osm"],
          }),
        ]}
      />,
    );
    const f = fila("Café Andino");
    expect(f).toHaveTextContent("Andino SAS");
    expect(f).toHaveTextContent("900123456");
    expect(f).toHaveTextContent("3001234567 (WhatsApp)");
    expect(f).toHaveTextContent("hola@andino.co");
    // Sin protocolo se le agrega https:// (la etiqueta solo quita "www." cuando la URL trae protocolo).
    expect(within(f).getByRole("link", { name: "www.andino.co" })).toHaveAttribute("href", "https://www.andino.co");
    const ig = within(f).getByRole("link", { name: "instagram.com/cafeandino" });
    expect(ig).toHaveAttribute("href", "https://www.instagram.com/cafeandino");
    expect(ig).toHaveAttribute("rel", "noopener noreferrer");
    expect(ig).toHaveAttribute("target", "_blank");
  });

  it("no repite la razón social si es igual al nombre", () => {
    render(<LeadsTable onAbrir={vi.fn()} leads={[lead({ nombre: "Ferretería X", razonSocial: "Ferretería X" })]} />);
    expect(screen.getAllByText("Ferretería X")).toHaveLength(1);
  });

  it("un lead pendiente tiene 'Contactar'; uno contactado, su estado y 'Ver'", async () => {
    const onAbrir = vi.fn();
    render(
      <LeadsTable
        onAbrir={onAbrir}
        leads={[
          lead({ id: 1, nombre: "Pendiente" }),
          lead({ id: 2, nombre: "Respondido", estadoContacto: "RESPONDIO", calidad: "MEDIA", puntaje: 55 }),
          lead({ id: 3, nombre: "Bloqueado", noContactar: true }),
          lead({ id: 4, nombre: "Antiguo", contactado: true }),
        ]}
      />,
    );

    await userEvent.click(within(fila("Pendiente")).getByRole("button", { name: "Contactar" }));
    expect(onAbrir).toHaveBeenCalledWith(1);

    const respondido = fila("Respondido");
    expect(respondido).toHaveTextContent("Respondió");
    expect(respondido).toHaveTextContent("Calidad media55");
    await userEvent.click(within(respondido).getByRole("button", { name: "Ver" }));
    expect(onAbrir).toHaveBeenCalledWith(2);

    expect(fila("Bloqueado")).toHaveTextContent("No contactar");
    expect(within(fila("Bloqueado")).getByRole("button", { name: "Ver" })).toBeInTheDocument();
    expect(fila("Antiguo")).toHaveTextContent("Sin respuesta");
  });

  it("en Contactados dice 'Tú' si lo contactó el usuario de la sesión", () => {
    sessionStore.set(sesion({ id: 7 }));
    render(
      <LeadsTable
        variante="contactados"
        onAbrir={vi.fn()}
        leads={[
          lead({ nombre: "Mío", estadoContacto: "CONTACTADO", contactadoPor: { id: 7, fullName: "Andrés Saray", email: "a@l.co" } }),
          lead({ nombre: "De Ana", estadoContacto: "CONTACTADO", contactadoPor: { id: 2, fullName: "Ana Ruiz", email: "ana@l.co" } }),
          lead({ nombre: "Huérfano", estadoContacto: "CONTACTADO" }),
        ]}
      />,
    );
    expect(within(fila("Mío")).getByText("Tú")).toBeInTheDocument();
    expect(within(fila("De Ana")).getByText("Ana Ruiz")).toHaveAttribute("title", "ana@l.co");
    expect(fila("Huérfano")).toHaveTextContent("Sin asignar");
  });
});
