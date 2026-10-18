import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import LoginPage from "@/modules/auth/login-route";
import ProtectedLayout, { clientLoader } from "@/modules/auth/protected-layout";
import { sessionStore } from "@/shared/lib/session-store";
import { sesion } from "../../helpers/fixtures";
import { mockFetch, ok } from "../../helpers/http";

/** Muestra la URL actual para comprobar redirecciones. */
function Ubicacion() {
  const { pathname, search } = useLocation();
  return <p data-testid="ubicacion">{pathname + search}</p>;
}

function App(inicial: string) {
  const Stub = createRoutesStub([
    {
      path: "/login",
      Component: () => (
        <>
          <LoginPage />
          <Ubicacion />
        </>
      ),
    },
    {
      Component: ProtectedLayout,
      children: [
        { path: "/", Component: () => <h1>Buscar leads</h1> },
        { path: "/contactados", Component: () => <h1>Contactados</h1> },
      ],
    },
  ]);
  return render(<Stub initialEntries={[inicial]} />);
}

describe("clientLoader del layout protegido", () => {
  const args = (url: string) => ({ request: new Request(url) }) as Parameters<typeof clientLoader>[0];

  it("sin sesión redirige al login guardando a dónde volver", async () => {
    const res = await clientLoader(args("http://localhost/contactados?equipo=1")).catch((r: unknown) => r);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(302);
    expect((res as Response).headers.get("Location")).toBe("/login?volver=%2Fcontactados%3Fequipo%3D1");
  });

  it("desde la raíz no agrega ?volver", async () => {
    const res = (await clientLoader(args("http://localhost/")).catch((r: unknown) => r)) as Response;
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("con sesión deja pasar", async () => {
    sessionStore.set(sesion());
    await expect(clientLoader(args("http://localhost/metricas"))).resolves.toBeNull();
  });
});

describe("layout protegido", () => {
  it("con sesión muestra el menú, el usuario y la página", async () => {
    sessionStore.set(sesion({ rol: "ADMIN" }));
    App("/contactados");

    expect(await screen.findByRole("heading", { name: "Contactados" })).toBeInTheDocument();
    const secciones = screen.getByRole("navigation", { name: "Secciones" });
    expect(secciones).toHaveTextContent("Buscar leads");
    expect(screen.getByRole("link", { name: "Contactados" })).toHaveClass("activo");
    expect(screen.getByText("Andrés Saray")).toBeInTheDocument();
    expect(screen.getByText("Administrador")).toBeInTheDocument();
  });

  it("al cerrar sesión vuelve al login con ?volver", async () => {
    sessionStore.set(sesion());
    App("/contactados?equipo=1");

    await userEvent.click(await screen.findByRole("button", { name: "Cerrar sesión" }));

    expect(sessionStore.get()).toBeNull();
    expect(await screen.findByTestId("ubicacion")).toHaveTextContent("/login?volver=%2Fcontactados%3Fequipo%3D1");
  });

  it("si la sesión vence (token inválido) también manda al login", async () => {
    sessionStore.set(sesion());
    App("/");
    await screen.findByRole("heading", { name: "Buscar leads" });

    act(() => sessionStore.clear());

    expect(await screen.findByRole("heading", { name: "Leads Colombia" })).toBeInTheDocument();
  });

  it("el menú recuerda los filtros de cada sección", async () => {
    sessionStore.set(sesion());
    App("/contactados?equipo=1&pagina=2");
    await screen.findByRole("heading", { name: "Contactados" });

    await userEvent.click(screen.getByRole("link", { name: "Buscar leads" }));
    await screen.findByRole("heading", { name: "Buscar leads" });

    expect(screen.getByRole("link", { name: "Contactados" })).toHaveAttribute("href", "/contactados?equipo=1&pagina=2");
  });

  it("el botón de menú abre el panel y Escape lo cierra", async () => {
    sessionStore.set(sesion());
    const { container } = App("/");
    await screen.findByRole("heading", { name: "Buscar leads" });
    const abrir = screen.getByRole("button", { name: "Abrir menú" });

    await userEvent.click(abrir);
    expect(container.querySelector(".app")).toHaveClass("menu-abierto");
    expect(document.body.style.overflow).toBe("hidden");

    await userEvent.keyboard("{Escape}");
    expect(container.querySelector(".app")).not.toHaveClass("menu-abierto");
    expect(document.body.style.overflow).toBe("");
  });
});

describe("página de login", () => {
  it("después de entrar vuelve a la ruta pedida", async () => {
    mockFetch({ "POST /api/auth/login": ok(sesion()) });
    App("/login?volver=/contactados");

    await userEvent.type(screen.getByLabelText("Correo"), "andres@leads.co");
    await userEvent.type(screen.getByLabelText("Contraseña"), "secreta");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("heading", { name: "Contactados" })).toBeInTheDocument();
  });

  it("no redirige a otro sitio aunque ?volver lo pida", async () => {
    sessionStore.set(sesion());
    App("/login?volver=//malo.com");
    expect(await screen.findByRole("heading", { name: "Buscar leads" })).toBeInTheDocument();
  });
});
