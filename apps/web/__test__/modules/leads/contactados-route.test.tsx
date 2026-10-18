import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import ContactadosPage from "@/modules/leads/contactados-route";
import { sessionStore } from "@/shared/lib/session-store";
import { lead, sesion } from "../../helpers/fixtures";
import { falla, mockFetch, ok, type Manejador } from "../../helpers/http";

const MIEMBROS = [
  { id: 2, fullName: "Ana Ruiz", email: "ana@l.co", contactados: 3 },
  { id: 7, fullName: "Andrés Saray", email: "andres@l.co", contactados: 1 },
];

function Url() {
  const { search } = useLocation();
  return <output data-testid="url">{search}</output>;
}

function abrir(url = "/contactados") {
  const Stub = createRoutesStub([
    {
      path: "/contactados",
      Component: () => (
        <>
          <ContactadosPage />
          <Url />
        </>
      ),
    },
  ]);
  return render(<Stub initialEntries={[url]} />);
}

/** API con el listado de leads; devuelve las queries pedidas a /api/leads. */
function api(miembros: Manejador | Response = ok(MIEMBROS)) {
  const queries: Record<string, string>[] = [];
  mockFetch({
    "/api/usuarios/miembros": miembros,
    "/api/dapta/estado": ok({ modo: "desactivado", contacta: false, webhook: false, urlWebhook: null }),
    "/api/leads": (url) => {
      queries.push(Object.fromEntries(url.searchParams));
      return ok({ total: 0, pagina: 1, limite: 20, leads: [] as ReturnType<typeof lead>[] });
    },
  });
  return queries;
}

const ultima = (q: Record<string, string>[]) => q[q.length - 1];
const selector = (etiqueta: string) => screen.getByRole("button", { name: new RegExp(`^${etiqueta}`) });

describe("Contactados", () => {
  it("un miembro ve por defecto solo los suyos", async () => {
    sessionStore.set(sesion({ id: 7 }));
    const q = api();
    abrir();
    expect(await screen.findByText("Todavía no has contactado leads. Dale “Contactar” en la búsqueda.")).toBeInTheDocument();
    expect(ultima(q)).toMatchObject({ contactado: "true", contactado_por: "7", pagina: "1" });
    expect(screen.getByText("Leads a los que tú ya les hiciste el primer acercamiento.")).toBeInTheDocument();
  });

  it("un administrador ve por defecto los de todo el equipo", async () => {
    sessionStore.set(sesion({ id: 1, rol: "ADMIN" }));
    const q = api();
    abrir();
    expect(await screen.findByText("Nadie del equipo ha contactado leads todavía.")).toBeInTheDocument();
    expect(ultima(q).contactado_por).toBeUndefined();
  });

  it("lee los filtros de la URL (incluido el ?equipo=1 antiguo)", async () => {
    sessionStore.set(sesion({ id: 7 }));
    const q = api();
    abrir("/contactados?equipo=1&estado=INTERESADO&calidad=ALTA&pagina=3");
    expect(await screen.findByText("No hay leads con esos filtros.")).toBeInTheDocument();
    expect(ultima(q)).toMatchObject({ estado: "INTERESADO", calidad: "ALTA", pagina: "3" });
    expect(ultima(q).contactado_por).toBeUndefined();
  });

  it("ignora valores inválidos en la URL", async () => {
    sessionStore.set(sesion({ id: 7 }));
    const q = api();
    abrir("/contactados?miembro=abc&estado=HACKEO&pagina=-4");
    await screen.findByText(/Todavía no has contactado/);
    expect(ultima(q)).toEqual({ contactado: "true", contactado_por: "7", pagina: "1", limite: "20" });
  });

  it("cambiar de miembro o de estado actualiza la URL y vuelve a la página 1", async () => {
    sessionStore.set(sesion({ id: 7 }));
    const q = api();
    abrir("/contactados?pagina=2");
    await screen.findByText(/Todavía no has contactado/);

    await userEvent.click(selector("Miembro"));
    await userEvent.click(await screen.findByRole("option", { name: /Ana Ruiz/ }));
    expect(screen.getByTestId("url")).toHaveTextContent("?miembro=2");
    expect(await screen.findByText("Ana Ruiz todavía no ha contactado leads.")).toBeInTheDocument();
    expect(ultima(q)).toMatchObject({ contactado_por: "2", pagina: "1" });

    await userEvent.click(selector("Estado"));
    await userEvent.click(screen.getByRole("option", { name: /Respondieron/ }));
    expect(screen.getByTestId("url")).toHaveTextContent("?miembro=2&estado=RESPONDIO%2CINTERESADO");

    await userEvent.click(selector("Estado"));
    await userEvent.click(screen.getByRole("option", { name: /Todos los estados/ }));
    expect(screen.getByTestId("url")).toHaveTextContent(/^\?miembro=2$/);
  });

  it("lista primero a 'Tú' con sus conteos", async () => {
    sessionStore.set(sesion({ id: 7 }));
    api();
    abrir();
    await userEvent.click(await screen.findByRole("button", { name: /^Miembro/ }));
    const opciones = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(opciones[0]).toContain("Todo el equipo2 miembros");
    expect(opciones[1]).toContain("Andrés Saray1 lead contactado");
    expect(opciones[1]).toContain("Tú");
    expect(opciones[2]).toContain("Ana Ruiz3 leads contactados");
  });

  it("si los miembros no cargan lo avisa pero la tabla sigue", async () => {
    sessionStore.set(sesion({ id: 7 }));
    const q = api(falla(500, "caída"));
    abrir();
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar la lista de miembros.caída");
    expect(ultima(q).contactado_por).toBe("7");
  });
});
