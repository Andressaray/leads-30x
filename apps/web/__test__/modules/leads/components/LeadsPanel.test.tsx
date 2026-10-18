import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LeadsPanel } from "@/modules/leads";
import { lead } from "../../../helpers/fixtures";
import { falla, mockFetch, ok } from "../../../helpers/http";

describe("LeadsPanel", () => {
  it("muestra el esqueleto, luego la tabla y pagina", async () => {
    mockFetch({
      "/api/leads": (url) => {
        const pagina = Number(url.searchParams.get("pagina"));
        return ok({ total: 25, pagina, limite: 20, leads: [lead({ nombre: `Lead de la página ${pagina}` })] });
      },
      "/api/dapta/estado": ok({ modo: "desactivado", contacta: false, webhook: false, urlWebhook: null }),
    });
    const { container } = render(<LeadsPanel filtros={{ busqueda: 42 }} />);

    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
    expect(await screen.findByText("Lead de la página 1")).toBeInTheDocument();
    expect(screen.getByText("25 leads · página 1 de 2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Siguiente ›" }));
    expect(await screen.findByText("Lead de la página 2")).toBeInTheDocument();
  });

  it("sin leads muestra el texto de vacío", async () => {
    mockFetch({ "/api/leads": ok({ total: 0, pagina: 1, limite: 20, leads: [] }) });
    render(<LeadsPanel filtros={{}} vacio="Aún no has contactado a nadie." />);
    expect(await screen.findByText("Aún no has contactado a nadie.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("si la API falla lo avisa", async () => {
    mockFetch({ "/api/leads": falla(500, "Base caída") });
    render(<LeadsPanel filtros={{}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar los leads.Base caída");
  });

  it("con envioDapta muestra la barra para mandar la página", async () => {
    mockFetch({
      "/api/leads": ok({ total: 1, pagina: 1, limite: 20, leads: [lead()] }),
      "/api/dapta/estado": ok({ modo: "activo", contacta: false, webhook: true, urlWebhook: null }),
    });
    render(<LeadsPanel filtros={{}} envioDapta />);
    expect(await screen.findByRole("button", { name: "Enviar a Dapta" })).toBeInTheDocument();
  });
});
