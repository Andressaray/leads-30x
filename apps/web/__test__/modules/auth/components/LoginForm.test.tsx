import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/modules/auth/components/LoginForm";
import { sessionStore } from "@/shared/lib/session-store";
import { sesion } from "../../../helpers/fixtures";
import { falla, mockFetch, ok } from "../../../helpers/http";

async function llenar(email = "andres@leads.co", password = "secreta") {
  await userEvent.type(screen.getByLabelText("Correo"), email);
  await userEvent.type(screen.getByLabelText("Contraseña"), password);
  await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
}

describe("LoginForm", () => {
  it("inicia sesión y avisa que terminó", async () => {
    mockFetch({ "POST /api/auth/login": ok(sesion()) });
    const onListo = vi.fn();
    render(<LoginForm onListo={onListo} />);

    await llenar();

    expect(onListo).toHaveBeenCalledOnce();
    expect(sessionStore.get()?.token).toBe("token-de-prueba");
  });

  it("deshabilita el botón mientras envía", async () => {
    let responder!: (r: Response) => void;
    mockFetch({ "POST /api/auth/login": () => new Promise<Response>((r) => (responder = r)) });
    render(<LoginForm onListo={vi.fn()} />);

    await llenar();

    expect(screen.getByRole("button", { name: "Entrando…" })).toBeDisabled();
    responder(ok(sesion()));
  });

  it("muestra el error de la API y deja reintentar", async () => {
    mockFetch({ "POST /api/auth/login": falla(401, "Correo o contraseña incorrectos") });
    const onListo = vi.fn();
    render(<LoginForm onListo={onListo} />);

    await llenar();

    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos");
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
    expect(onListo).not.toHaveBeenCalled();
  });

  it("no envía si faltan los campos obligatorios", async () => {
    const f = mockFetch();
    render(<LoginForm onListo={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(f).not.toHaveBeenCalled();
  });
});
