import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Paginator } from "@/modules/leads/components/Paginator";

const previous = () => screen.getByRole("button", { name: "‹ Anterior" });
const next = () => screen.getByRole("button", { name: "Siguiente ›" });

describe("Paginador", () => {
  it("without leads it is not shown", () => {
    const { container } = render(<Paginator total={0} page={1} limit={20} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("on the first page it only allows moving forward", async () => {
    const onChange = vi.fn();
    render(<Paginator total={45} page={1} limit={20} onChange={onChange} />);
    expect(screen.getByText("45 leads · página 1 de 3")).toBeInTheDocument();
    expect(previous()).toBeDisabled();
    await userEvent.click(next());
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("on the last page it only allows moving back", async () => {
    const onChange = vi.fn();
    render(<Paginator total={45} page={3} limit={20} onChange={onChange} />);
    expect(next()).toBeDisabled();
    await userEvent.click(previous());
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("uses the singular with one lead", () => {
    render(<Paginator total={1} page={1} limit={20} onChange={vi.fn()} />);
    expect(screen.getByText("1 lead · página 1 de 1")).toBeInTheDocument();
    expect(next()).toBeDisabled();
  });
});
