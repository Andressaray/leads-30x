import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { BusquedaForm } from "@/modules/busquedas/components/BusquedaForm";
import type { FormBusqueda } from "@/modules/busquedas/store/busqueda-store";
import { falla, mockFetch, ok } from "../../../helpers/http";

const DEPARTAMENTOS = [
  { codigo: "05", nombre: "Antioquia" },
  { codigo: "99", nombre: "Vichada" },
];
const CATEGORIAS = [{ clave: "restaurantes", nombre: "Restaurantes" }];
const MUNICIPIOS = [
  { codigo: "05088", nombre: "Bello", departamento: "Antioquia", codigoDepartamento: "05" },
  { codigo: "05001", nombre: "Medellín", departamento: "Antioquia", codigoDepartamento: "05" },
];

function Formulario({ onBuscar = vi.fn(), buscando = false }) {
  const [valores, setValores] = useState<FormBusqueda>({ departamento: "", codigo: "", categoria: "" });
  return (
    <BusquedaForm
      categorias={CATEGORIAS}
      departamentos={DEPARTAMENTOS}
      valores={valores}
      onCambiar={(c) => setValores((v) => ({ ...v, ...c }))}
      buscando={buscando}
      onBuscar={onBuscar}
    />
  );
}

const ciudad = () => screen.getByLabelText("Ciudad");

describe("BusquedaForm", () => {
  it("la ciudad está deshabilitada hasta elegir el departamento", () => {
    mockFetch();
    render(<Formulario />);
    expect(ciudad()).toBeDisabled();
    expect(ciudad()).toHaveDisplayValue("Elige primero el departamento");
  });

  it("carga las ciudades del departamento y envía código y categoría", async () => {
    mockFetch({ "/api/catalogo/municipios": ok(MUNICIPIOS) });
    const onBuscar = vi.fn();
    render(<Formulario onBuscar={onBuscar} />);

    await userEvent.selectOptions(screen.getByLabelText("Departamento"), "05");
    await vi.waitFor(() => expect(ciudad()).toBeEnabled());
    expect(within(ciudad()).getAllByRole("option").map((o) => o.textContent)).toEqual(["Elige una ciudad…", "Bello", "Medellín"]);

    await userEvent.selectOptions(ciudad(), "05001");
    await userEvent.selectOptions(screen.getByLabelText("Categoría"), "restaurantes");
    await userEvent.click(screen.getByRole("button", { name: "Buscar leads" }));

    expect(onBuscar).toHaveBeenCalledWith({ codigo: "05001", categoria: "restaurantes" });
  });

  it("sin categoría no la manda", async () => {
    mockFetch({ "/api/catalogo/municipios": ok(MUNICIPIOS) });
    const onBuscar = vi.fn();
    render(<Formulario onBuscar={onBuscar} />);
    await userEvent.selectOptions(screen.getByLabelText("Departamento"), "05");
    await vi.waitFor(() => expect(ciudad()).toBeEnabled());
    await userEvent.selectOptions(ciudad(), "05088");
    await userEvent.click(screen.getByRole("button", { name: "Buscar leads" }));
    expect(onBuscar).toHaveBeenCalledWith({ codigo: "05088" });
  });

  it("avisa si no se pudieron cargar las ciudades", async () => {
    mockFetch({ "/api/catalogo/municipios": falla(500, "Error") });
    render(<Formulario />);
    await userEvent.selectOptions(screen.getByLabelText("Departamento"), "99");
    await vi.waitFor(() => expect(ciudad()).toHaveDisplayValue("No se pudieron cargar las ciudades"));
    expect(ciudad()).toBeDisabled();
  });

  it("el botón se deshabilita mientras busca", () => {
    mockFetch();
    render(<Formulario buscando />);
    expect(screen.getByRole("button", { name: "Buscar leads" })).toBeDisabled();
  });
});
