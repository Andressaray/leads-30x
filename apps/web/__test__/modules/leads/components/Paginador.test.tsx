import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Paginador } from "@/modules/leads/components/Paginador";

const anterior = () => screen.getByRole("button", { name: "‹ Anterior" });
const siguiente = () => screen.getByRole("button", { name: "Siguiente ›" });

describe("Paginador", () => {
  it("sin leads no se muestra", () => {
    const { container } = render(<Paginador total={0} pagina={1} limite={20} onCambiar={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("en la primera página solo deja avanzar", async () => {
    const onCambiar = vi.fn();
    render(<Paginador total={45} pagina={1} limite={20} onCambiar={onCambiar} />);
    expect(screen.getByText("45 leads · página 1 de 3")).toBeInTheDocument();
    expect(anterior()).toBeDisabled();
    await userEvent.click(siguiente());
    expect(onCambiar).toHaveBeenCalledWith(2);
  });

  it("en la última página solo deja retroceder", async () => {
    const onCambiar = vi.fn();
    render(<Paginador total={45} pagina={3} limite={20} onCambiar={onCambiar} />);
    expect(siguiente()).toBeDisabled();
    await userEvent.click(anterior());
    expect(onCambiar).toHaveBeenCalledWith(2);
  });

  it("usa singular con un lead", () => {
    render(<Paginador total={1} pagina={1} limite={20} onCambiar={vi.fn()} />);
    expect(screen.getByText("1 lead · página 1 de 1")).toBeInTheDocument();
    expect(siguiente()).toBeDisabled();
  });
});
