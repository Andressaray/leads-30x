import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LeadsTable } from "@/modules/leads/components/LeadsTable";
import { sessionStore } from "@/shared/lib/session-store";
import { lead, session } from "../../../helpers/fixtures";

const headers = () => screen.getAllByRole("columnheader").map((th) => th.textContent);
const row = (name: string) => screen.getByRole("row", { name: new RegExp(name) });

describe("LeadsTable", () => {
  it("the columns change according to the variant", () => {
    const { rerender } = render(<LeadsTable leads={[]} onOpen={vi.fn()} />);
    expect(headers()).toEqual(["Negocio", "NIT", "Contacto", "Dirección", "Fuentes", "Estado"]);
    rerender(<LeadsTable leads={[]} variant="contacted" onOpen={vi.fn()} />);
    expect(headers()).toEqual(["Negocio", "NIT", "Contacto", "Dirección", "Fuentes", "Contactado por", "Último contacto", "Estado"]);
  });

  it("shows the contact data and safe links", () => {
    render(
      <LeadsTable
        onOpen={vi.fn()}
        leads={[
          lead({
            name: "Café Andino",
            legalName: "Andino SAS",
            nit: "900123456",
            phones: [{ number: "3001234567", type: "mobile", whatsapp: true }],
            emails: ["hola@andino.co"],
            websites: ["www.andino.co"],
            socialLinks: ["https://www.instagram.com/cafeandino"],
            sources: ["dane", "osm"],
          }),
        ]}
      />,
    );
    const f = row("Café Andino");
    expect(f).toHaveTextContent("Andino SAS");
    expect(f).toHaveTextContent("900123456");
    expect(f).toHaveTextContent("3001234567 (WhatsApp)");
    expect(f).toHaveTextContent("hola@andino.co");
    // Without a protocol https:// is added (the label only removes "www." when the URL has a protocol).
    expect(within(f).getByRole("link", { name: "www.andino.co" })).toHaveAttribute("href", "https://www.andino.co");
    const ig = within(f).getByRole("link", { name: "instagram.com/cafeandino" });
    expect(ig).toHaveAttribute("href", "https://www.instagram.com/cafeandino");
    expect(ig).toHaveAttribute("rel", "noopener noreferrer");
    expect(ig).toHaveAttribute("target", "_blank");
  });

  it("does not repeat the legal name if it equals the name", () => {
    render(<LeadsTable onOpen={vi.fn()} leads={[lead({ name: "Ferretería X", legalName: "Ferretería X" })]} />);
    expect(screen.getAllByText("Ferretería X")).toHaveLength(1);
  });

  it("a pending lead has 'Contactar'; a contacted one, its status and 'Ver'", async () => {
    const onOpen = vi.fn();
    render(
      <LeadsTable
        onOpen={onOpen}
        leads={[
          lead({ id: 1, name: "Pendiente" }),
          lead({ id: 2, name: "Respondido", contactStatus: "REPLIED", quality: "MEDIUM", score: 55 }),
          lead({ id: 3, name: "Bloqueado", doNotContact: true }),
          lead({ id: 4, name: "Antiguo", contacted: true }),
        ]}
      />,
    );

    await userEvent.click(within(row("Pendiente")).getByRole("button", { name: "Contactar" }));
    expect(onOpen).toHaveBeenCalledWith(1);

    const replied = row("Respondido");
    expect(replied).toHaveTextContent("Respondió");
    expect(replied).toHaveTextContent("Calidad media55");
    await userEvent.click(within(replied).getByRole("button", { name: "Ver" }));
    expect(onOpen).toHaveBeenCalledWith(2);

    expect(row("Bloqueado")).toHaveTextContent("No contactar");
    expect(within(row("Bloqueado")).getByRole("button", { name: "Ver" })).toBeInTheDocument();
    expect(row("Antiguo")).toHaveTextContent("Sin respuesta");
  });

  it("in Contacted it says 'Tú' if the session user contacted it", () => {
    sessionStore.set(session({ id: 7 }));
    render(
      <LeadsTable
        variant="contacted"
        onOpen={vi.fn()}
        leads={[
          lead({ name: "Mío", contactStatus: "CONTACTED", contactedBy: { id: 7, fullName: "Andrés Saray", email: "a@l.co" } }),
          lead({ name: "De Ana", contactStatus: "CONTACTED", contactedBy: { id: 2, fullName: "Ana Ruiz", email: "ana@l.co" } }),
          lead({ name: "Huérfano", contactStatus: "CONTACTED" }),
        ]}
      />,
    );
    expect(within(row("Mío")).getByText("Tú")).toBeInTheDocument();
    expect(within(row("De Ana")).getByText("Ana Ruiz")).toHaveAttribute("title", "ana@l.co");
    expect(row("Huérfano")).toHaveTextContent("Sin asignar");
  });
});
