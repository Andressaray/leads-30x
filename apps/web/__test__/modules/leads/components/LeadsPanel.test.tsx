import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LeadsPanel } from "@/modules/leads";
import { lead } from "../../../helpers/fixtures";
import { failure, mockFetch, ok } from "../../../helpers/http";

describe("LeadsPanel", () => {
  it("shows the skeleton, then the table, and paginates", async () => {
    mockFetch({
      "/api/leads": (url) => {
        const page = Number(url.searchParams.get("page"));
        return ok({ total: 25, page, limit: 20, leads: [lead({ name: `Lead de la página ${page}` })] });
      },
      "/api/dapta/status": ok({ mode: "disabled", contacts: false, webhook: false, urlWebhook: null }),
    });
    const { container } = render(<LeadsPanel filters={{ search: 42 }} />);

    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
    expect(await screen.findByText("Lead de la página 1")).toBeInTheDocument();
    expect(screen.getByText("25 leads · página 1 de 2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Siguiente ›" }));
    expect(await screen.findByText("Lead de la página 2")).toBeInTheDocument();
  });

  it("without leads it shows the empty text", async () => {
    mockFetch({ "/api/leads": ok({ total: 0, page: 1, limit: 20, leads: [] }) });
    render(<LeadsPanel filters={{}} empty="Aún no has contactado a nadie." />);
    expect(await screen.findByText("Aún no has contactado a nadie.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("if the API fails it says so", async () => {
    mockFetch({ "/api/leads": failure(500, "Base caída") });
    render(<LeadsPanel filters={{}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar los leads.Base caída");
  });

  it("with daptaDispatch it shows the bar to send the page", async () => {
    mockFetch({
      "/api/leads": ok({ total: 1, page: 1, limit: 20, leads: [lead()] }),
      "/api/dapta/status": ok({ mode: "active", contacts: false, webhook: true, urlWebhook: null }),
    });
    render(<LeadsPanel filters={{}} daptaDispatch />);
    expect(await screen.findByRole("button", { name: "Enviar a Dapta" })).toBeInTheDocument();
  });
});
