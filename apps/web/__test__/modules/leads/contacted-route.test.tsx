import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import ContactedPage from "@/modules/leads/contacted-route";
import { sessionStore } from "@/shared/lib/session-store";
import { lead, session } from "../../helpers/fixtures";
import { failure, mockFetch, ok, type Handler } from "../../helpers/http";

const MEMBERS = [
  { id: 2, fullName: "Ana Ruiz", email: "ana@l.co", contacted: 3 },
  { id: 7, fullName: "Andrés Saray", email: "andres@l.co", contacted: 1 },
];

function Url() {
  const { search } = useLocation();
  return <output data-testid="url">{search}</output>;
}

function open(url = "/contacted") {
  const Stub = createRoutesStub([
    {
      path: "/contacted",
      Component: () => (
        <>
          <ContactedPage />
          <Url />
        </>
      ),
    },
  ]);
  return render(<Stub initialEntries={[url]} />);
}

/** API with the lead listing; returns the queries requested to /api/leads. */
function api(members: Handler | Response = ok(MEMBERS)) {
  const queries: Record<string, string>[] = [];
  mockFetch({
    "/api/users/members": members,
    "/api/dapta/status": ok({ mode: "disabled", contacts: false, webhook: false, urlWebhook: null }),
    "/api/leads": (url) => {
      queries.push(Object.fromEntries(url.searchParams));
      return ok({ total: 0, page: 1, limit: 20, leads: [] as ReturnType<typeof lead>[] });
    },
  });
  return queries;
}

const last = (q: Record<string, string>[]) => q[q.length - 1];
const selector = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}`) });

describe("Contacted", () => {
  it("a member sees only their own by default", async () => {
    sessionStore.set(session({ id: 7 }));
    const q = api();
    open();
    expect(await screen.findByText("Todavía no has contactado leads. Dale “Contactar” en la búsqueda.")).toBeInTheDocument();
    expect(last(q)).toMatchObject({ contacted: "true", contacted_by: "7", page: "1" });
    expect(screen.getByText("Leads a los que tú ya les hiciste el primer acercamiento.")).toBeInTheDocument();
  });

  it("an administrator sees the whole team's by default", async () => {
    sessionStore.set(session({ id: 1, role: "ADMIN" }));
    const q = api();
    open();
    expect(await screen.findByText("Nadie del equipo ha contactado leads todavía.")).toBeInTheDocument();
    expect(last(q).contacted_by).toBeUndefined();
  });

  it("reads the filters from the URL (including the old ?team=1)", async () => {
    sessionStore.set(session({ id: 7 }));
    const q = api();
    open("/contacted?team=1&status=INTERESTED&quality=HIGH&page=3");
    expect(await screen.findByText("No hay leads con esos filtros.")).toBeInTheDocument();
    expect(last(q)).toMatchObject({ status: "INTERESTED", quality: "HIGH", page: "3" });
    expect(last(q).contacted_by).toBeUndefined();
  });

  it("ignores invalid values in the URL", async () => {
    sessionStore.set(session({ id: 7 }));
    const q = api();
    open("/contacted?member=abc&status=HACKEO&page=-4");
    await screen.findByText(/Todavía no has contactado/);
    expect(last(q)).toEqual({ contacted: "true", contacted_by: "7", page: "1", limit: "20" });
  });

  it("changing the member or the status updates the URL and goes back to page 1", async () => {
    sessionStore.set(session({ id: 7 }));
    const q = api();
    open("/contacted?page=2");
    await screen.findByText(/Todavía no has contactado/);

    await userEvent.click(selector("Miembro"));
    await userEvent.click(await screen.findByRole("option", { name: /Ana Ruiz/ }));
    expect(screen.getByTestId("url")).toHaveTextContent("?member=2");
    expect(await screen.findByText("Ana Ruiz todavía no ha contactado leads.")).toBeInTheDocument();
    expect(last(q)).toMatchObject({ contacted_by: "2", page: "1" });

    await userEvent.click(selector("Estado"));
    await userEvent.click(screen.getByRole("option", { name: /Respondieron/ }));
    expect(screen.getByTestId("url")).toHaveTextContent("?member=2&status=REPLIED%2CINTERESTED");

    await userEvent.click(selector("Estado"));
    await userEvent.click(screen.getByRole("option", { name: /Todos los estados/ }));
    expect(screen.getByTestId("url")).toHaveTextContent(/^\?member=2$/);
  });

  it("lists 'Tú' first with their counts", async () => {
    sessionStore.set(session({ id: 7 }));
    api();
    open();
    await userEvent.click(await screen.findByRole("button", { name: /^Miembro/ }));
    const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(options[0]).toContain("Todo el equipo2 miembros");
    expect(options[1]).toContain("Andrés Saray1 lead contactado");
    expect(options[1]).toContain("Tú");
    expect(options[2]).toContain("Ana Ruiz3 leads contactados");
  });

  it("if the members do not load it says so but the table keeps working", async () => {
    sessionStore.set(session({ id: 7 }));
    const q = api(failure(500, "caída"));
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar la lista de miembros.caída");
    expect(last(q).contacted_by).toBe("7");
  });
});
