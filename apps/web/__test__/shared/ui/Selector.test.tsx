import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Selector, type SelectorOption } from "@/shared/ui";

const OPTIONS: SelectorOption[] = [
  { value: "all", label: "Todo el equipo" },
  { value: "1", label: "Ana Ruiz", detail: "ana@leads.co" },
  { value: "2", label: "Álvaro Díaz" },
  { value: "3", label: "Beatriz Mora" },
];

function Test({ onChange = vi.fn(), initial = "all", disabled = false }) {
  const [value, setValue] = useState(initial);
  return (
    <Selector
      label="Contactado por"
      options={OPTIONS}
      value={value}
      disabled={disabled}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

const button = () => screen.getByRole("button", { name: /Contactado por/ });
const active = () => document.getElementById(screen.getByRole("listbox").getAttribute("aria-activedescendant")!);

describe("Selector", () => {
  it("shows the selected option and opens the list with a click", async () => {
    render(<Test />);
    expect(button()).toHaveAccessibleName("Contactado por Todo el equipo");
    expect(button()).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(button());

    expect(button()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(4);
    expect(screen.getByRole("option", { name: /Todo el equipo/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("listbox")).toHaveFocus();
  });

  it("choosing with the mouse changes the value, closes and returns focus to the button", async () => {
    const onChange = vi.fn();
    render(<Test onChange={onChange} />);
    await userEvent.click(button());
    await userEvent.click(screen.getByRole("option", { name: /Beatriz Mora/ }));

    expect(onChange).toHaveBeenCalledWith("3");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
    expect(button()).toHaveAccessibleName("Contactado por Beatriz Mora");
  });

  it("choosing the same option again does not report a change", async () => {
    const onChange = vi.fn();
    render(<Test onChange={onChange} />);
    await userEvent.click(button());
    await userEvent.click(screen.getByRole("option", { name: /Todo el equipo/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("works with the keyboard: arrows, Home/End and Enter", async () => {
    const onChange = vi.fn();
    render(<Test onChange={onChange} />);
    button().focus();

    await userEvent.keyboard("{ArrowDown}");
    expect(active()).toHaveTextContent("Todo el equipo");

    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(active()).toHaveTextContent("Álvaro Díaz");

    await userEvent.keyboard("{End}");
    expect(active()).toHaveTextContent("Beatriz Mora");
    await userEvent.keyboard("{ArrowDown}");
    expect(active()).toHaveTextContent("Beatriz Mora");

    await userEvent.keyboard("{Home}{ArrowUp}");
    expect(active()).toHaveTextContent("Todo el equipo");

    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("1");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("a letter jumps to the next option that starts with it, regardless of accents", async () => {
    render(<Test />);
    button().focus();
    await userEvent.keyboard("{Enter}");

    await userEvent.keyboard("a");
    expect(active()).toHaveTextContent("Ana Ruiz");
    await userEvent.keyboard("a");
    expect(active()).toHaveTextContent("Álvaro Díaz");
    await userEvent.keyboard("a");
    expect(active()).toHaveTextContent("Ana Ruiz");
  });

  it("Escape closes without changing and so does a click outside", async () => {
    const onChange = vi.fn();
    render(
      <>
        <Test onChange={onChange} />
        <p>afuera</p>
      </>,
    );
    await userEvent.click(button());
    await userEvent.keyboard("{ArrowDown}{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(button()).toHaveFocus();

    await userEvent.click(button());
    await userEvent.click(screen.getByText("afuera"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disabled does not open", async () => {
    render(<Test disabled />);
    await userEvent.click(button());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows the placeholder if the value is not among the options", () => {
    render(<Test initial="99" />);
    expect(button()).toHaveTextContent("Elige una opción…");
  });
});
