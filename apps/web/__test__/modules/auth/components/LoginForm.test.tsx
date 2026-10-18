import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/modules/auth/components/LoginForm";
import { sessionStore } from "@/shared/lib/session-store";
import { session } from "../../../helpers/fixtures";
import { failure, mockFetch, ok } from "../../../helpers/http";

async function fill(email = "andres@leads.co", password = "secreta") {
  await userEvent.type(screen.getByLabelText("Correo"), email);
  await userEvent.type(screen.getByLabelText("Contraseña"), password);
  await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
}

describe("LoginForm", () => {
  it("logs in and reports that it finished", async () => {
    mockFetch({ "POST /api/auth/login": ok(session()) });
    const onReady = vi.fn();
    render(<LoginForm onReady={onReady} />);

    await fill();

    expect(onReady).toHaveBeenCalledOnce();
    expect(sessionStore.get()?.token).toBe("test-token");
  });

  it("disables the button while sending", async () => {
    let respond!: (r: Response) => void;
    mockFetch({ "POST /api/auth/login": () => new Promise<Response>((r) => (respond = r)) });
    render(<LoginForm onReady={vi.fn()} />);

    await fill();

    expect(screen.getByRole("button", { name: "Entrando…" })).toBeDisabled();
    respond(ok(session()));
  });

  it("shows the API error and allows retrying", async () => {
    mockFetch({ "POST /api/auth/login": failure(401, "Correo o contraseña incorrectos") });
    const onReady = vi.fn();
    render(<LoginForm onReady={onReady} />);

    await fill();

    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos");
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
    expect(onReady).not.toHaveBeenCalled();
  });

  it("does not send if required fields are missing", async () => {
    const f = mockFetch();
    render(<LoginForm onReady={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(f).not.toHaveBeenCalled();
  });
});
