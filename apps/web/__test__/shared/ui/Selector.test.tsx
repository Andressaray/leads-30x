import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Selector, type OpcionSelector } from "@/shared/ui";

const OPCIONES: OpcionSelector[] = [
  { valor: "todos", etiqueta: "Todo el equipo" },
  { valor: "1", etiqueta: "Ana Ruiz", detalle: "ana@leads.co" },
  { valor: "2", etiqueta: "Álvaro Díaz" },
  { valor: "3", etiqueta: "Beatriz Mora" },
];

function Prueba({ onCambiar = vi.fn(), inicial = "todos", deshabilitado = false }) {
  const [valor, setValor] = useState(inicial);
  return (
    <Selector
      etiqueta="Contactado por"
      opciones={OPCIONES}
      valor={valor}
      deshabilitado={deshabilitado}
      onCambiar={(v) => {
        setValor(v);
        onCambiar(v);
      }}
    />
  );
}

const boton = () => screen.getByRole("button", { name: /Contactado por/ });
const activa = () => document.getElementById(screen.getByRole("listbox").getAttribute("aria-activedescendant")!);

describe("Selector", () => {
  it("muestra la opción elegida y abre la lista con un clic", async () => {
    render(<Prueba />);
    expect(boton()).toHaveAccessibleName("Contactado por Todo el equipo");
    expect(boton()).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(boton());

    expect(boton()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(4);
    expect(screen.getByRole("option", { name: /Todo el equipo/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("listbox")).toHaveFocus();
  });

  it("elegir con el ratón cambia el valor, cierra y devuelve el foco al botón", async () => {
    const onCambiar = vi.fn();
    render(<Prueba onCambiar={onCambiar} />);
    await userEvent.click(boton());
    await userEvent.click(screen.getByRole("option", { name: /Beatriz Mora/ }));

    expect(onCambiar).toHaveBeenCalledWith("3");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(boton()).toHaveFocus();
    expect(boton()).toHaveAccessibleName("Contactado por Beatriz Mora");
  });

  it("volver a elegir la misma opción no avisa un cambio", async () => {
    const onCambiar = vi.fn();
    render(<Prueba onCambiar={onCambiar} />);
    await userEvent.click(boton());
    await userEvent.click(screen.getByRole("option", { name: /Todo el equipo/ }));
    expect(onCambiar).not.toHaveBeenCalled();
  });

  it("se maneja con el teclado: flechas, Inicio/Fin y Enter", async () => {
    const onCambiar = vi.fn();
    render(<Prueba onCambiar={onCambiar} />);
    boton().focus();

    await userEvent.keyboard("{ArrowDown}");
    expect(activa()).toHaveTextContent("Todo el equipo");

    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(activa()).toHaveTextContent("Álvaro Díaz");

    await userEvent.keyboard("{End}");
    expect(activa()).toHaveTextContent("Beatriz Mora");
    await userEvent.keyboard("{ArrowDown}");
    expect(activa()).toHaveTextContent("Beatriz Mora");

    await userEvent.keyboard("{Home}{ArrowUp}");
    expect(activa()).toHaveTextContent("Todo el equipo");

    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onCambiar).toHaveBeenCalledWith("1");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("una letra salta a la siguiente opción que empieza por ella, sin importar tildes", async () => {
    render(<Prueba />);
    boton().focus();
    await userEvent.keyboard("{Enter}");

    await userEvent.keyboard("a");
    expect(activa()).toHaveTextContent("Ana Ruiz");
    await userEvent.keyboard("a");
    expect(activa()).toHaveTextContent("Álvaro Díaz");
    await userEvent.keyboard("a");
    expect(activa()).toHaveTextContent("Ana Ruiz");
  });

  it("Escape cierra sin cambiar y un clic afuera también", async () => {
    const onCambiar = vi.fn();
    render(
      <>
        <Prueba onCambiar={onCambiar} />
        <p>afuera</p>
      </>,
    );
    await userEvent.click(boton());
    await userEvent.keyboard("{ArrowDown}{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(boton()).toHaveFocus();

    await userEvent.click(boton());
    await userEvent.click(screen.getByText("afuera"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onCambiar).not.toHaveBeenCalled();
  });

  it("deshabilitado no se abre", async () => {
    render(<Prueba deshabilitado />);
    await userEvent.click(boton());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("muestra el placeholder si el valor no está entre las opciones", () => {
    render(<Prueba inicial="99" />);
    expect(boton()).toHaveTextContent("Elige una opción…");
  });
});
