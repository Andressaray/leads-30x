import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import LoginPage from "@/modules/auth/login-route";
import ProtectedLayout, { clientLoader } from "@/modules/auth/protected-layout";
import { sessionStore } from "@/shared/lib/session-store";
import { session } from "../../helpers/fixtures";
import { mockFetch, ok } from "../../helpers/http";

/** Shows the current URL to check redirects. */
function Location() {
  const { pathname, search } = useLocation();
  return <p data-testid="location">{pathname + search}</p>;
}

function App(initial: string) {
  const Stub = createRoutesStub([
    {
      path: "/login",
      Component: () => (
        <>
          <LoginPage />
          <Location />
        </>
      ),
    },
    {
      Component: ProtectedLayout,
      children: [
        { path: "/", Component: () => <h1>Buscar leads</h1> },
        { path: "/contacted", Component: () => <h1>Contactados</h1> },
      ],
    },
  ]);
  return render(<Stub initialEntries={[initial]} />);
}

describe("protected layout clientLoader", () => {
  const args = (url: string) => ({ request: new Request(url) }) as Parameters<typeof clientLoader>[0];

  it("without a session it redirects to login, remembering where to return", async () => {
    const res = await clientLoader(args("http://localhost/contacted?team=1")).catch((r: unknown) => r);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(302);
    expect((res as Response).headers.get("Location")).toBe("/login?returnTo=%2Fcontacted%3Fteam%3D1");
  });

  it("from the root it does not add ?returnTo", async () => {
    const res = (await clientLoader(args("http://localhost/")).catch((r: unknown) => r)) as Response;
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("with a session it lets you through", async () => {
    sessionStore.set(session());
    await expect(clientLoader(args("http://localhost/metricas"))).resolves.toBeNull();
  });
});

describe("protected layout", () => {
  it("with a session it shows the menu, the user and the page", async () => {
    sessionStore.set(session({ role: "ADMIN" }));
    App("/contacted");

    expect(await screen.findByRole("heading", { name: "Contactados" })).toBeInTheDocument();
    const sections = screen.getByRole("navigation", { name: "Secciones" });
    expect(sections).toHaveTextContent("Buscar leads");
    expect(screen.getByRole("link", { name: "Contactados" })).toHaveClass("active");
    expect(screen.getByText("Andrés Saray")).toBeInTheDocument();
    expect(screen.getByText("Administrador")).toBeInTheDocument();
  });

  it("logging out returns to login with ?returnTo", async () => {
    sessionStore.set(session());
    App("/contacted?team=1");

    await userEvent.click(await screen.findByRole("button", { name: "Cerrar sesión" }));

    expect(sessionStore.get()).toBeNull();
    expect(await screen.findByTestId("location")).toHaveTextContent("/login?returnTo=%2Fcontacted%3Fteam%3D1");
  });

  it("if the session expires (invalid token) it also sends you to login", async () => {
    sessionStore.set(session());
    App("/");
    await screen.findByRole("heading", { name: "Buscar leads" });

    act(() => sessionStore.clear());

    expect(await screen.findByRole("heading", { name: "Leads Colombia" })).toBeInTheDocument();
  });

  it("the menu remembers each section's filters", async () => {
    sessionStore.set(session());
    App("/contacted?team=1&page=2");
    await screen.findByRole("heading", { name: "Contactados" });

    await userEvent.click(screen.getByRole("link", { name: "Buscar leads" }));
    await screen.findByRole("heading", { name: "Buscar leads" });

    expect(screen.getByRole("link", { name: "Contactados" })).toHaveAttribute("href", "/contacted?team=1&page=2");
  });

  it("the menu button opens the panel and Escape closes it", async () => {
    sessionStore.set(session());
    const { container } = App("/");
    await screen.findByRole("heading", { name: "Buscar leads" });
    const open = screen.getByRole("button", { name: "Abrir menú" });

    await userEvent.click(open);
    expect(container.querySelector(".app")).toHaveClass("menu-open");
    expect(document.body.style.overflow).toBe("hidden");

    await userEvent.keyboard("{Escape}");
    expect(container.querySelector(".app")).not.toHaveClass("menu-open");
    expect(document.body.style.overflow).toBe("");
  });
});

describe("login page", () => {
  it("after logging in it returns to the requested route", async () => {
    mockFetch({ "POST /api/auth/login": ok(session()) });
    App("/login?returnTo=/contacted");

    await userEvent.type(screen.getByLabelText("Correo"), "andres@leads.co");
    await userEvent.type(screen.getByLabelText("Contraseña"), "secreta");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("heading", { name: "Contactados" })).toBeInTheDocument();
  });

  it("it does not redirect to another site even if ?returnTo asks for it", async () => {
    sessionStore.set(session());
    App("/login?returnTo=//malo.com");
    expect(await screen.findByRole("heading", { name: "Buscar leads" })).toBeInTheDocument();
  });
});
