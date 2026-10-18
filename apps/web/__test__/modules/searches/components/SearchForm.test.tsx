import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SearchForm } from "@/modules/searches/components/SearchForm";
import type { SearchFormValues } from "@/modules/searches/store/search-store";
import { failure, mockFetch, ok } from "../../../helpers/http";

const DEPARTMENTS = [
  { code: "05", name: "Antioquia" },
  { code: "99", name: "Vichada" },
];
const CATEGORIES = [{ key: "restaurantes", name: "Restaurantes" }];
const MUNICIPALITIES = [
  { code: "05088", name: "Bello", department: "Antioquia", departmentCode: "05" },
  { code: "05001", name: "Medellín", department: "Antioquia", departmentCode: "05" },
];

function Form({ onSearch = vi.fn(), searching = false }) {
  const [values, setValues] = useState<SearchFormValues>({ department: "", code: "", category: "" });
  return (
    <SearchForm
      categories={CATEGORIES}
      departments={DEPARTMENTS}
      values={values}
      onChange={(c) => setValues((v) => ({ ...v, ...c }))}
      searching={searching}
      onSearch={onSearch}
    />
  );
}

const city = () => screen.getByLabelText("Ciudad");

describe("BusquedaForm", () => {
  it("the city is disabled until a department is chosen", () => {
    mockFetch();
    render(<Form />);
    expect(city()).toBeDisabled();
    expect(city()).toHaveDisplayValue("Elige primero el departamento");
  });

  it("loads the department's cities and sends code and category", async () => {
    mockFetch({ "/api/catalog/municipalities": ok(MUNICIPALITIES) });
    const onSearch = vi.fn();
    render(<Form onSearch={onSearch} />);

    await userEvent.selectOptions(screen.getByLabelText("Departamento"), "05");
    await vi.waitFor(() => expect(city()).toBeEnabled());
    expect(within(city()).getAllByRole("option").map((o) => o.textContent)).toEqual(["Elige una ciudad…", "Bello", "Medellín"]);

    await userEvent.selectOptions(city(), "05001");
    await userEvent.selectOptions(screen.getByLabelText("Categoría"), "restaurantes");
    await userEvent.click(screen.getByRole("button", { name: "Buscar leads" }));

    expect(onSearch).toHaveBeenCalledWith({ code: "05001", category: "restaurantes" });
  });

  it("without a category it does not send it", async () => {
    mockFetch({ "/api/catalog/municipalities": ok(MUNICIPALITIES) });
    const onSearch = vi.fn();
    render(<Form onSearch={onSearch} />);
    await userEvent.selectOptions(screen.getByLabelText("Departamento"), "05");
    await vi.waitFor(() => expect(city()).toBeEnabled());
    await userEvent.selectOptions(city(), "05088");
    await userEvent.click(screen.getByRole("button", { name: "Buscar leads" }));
    expect(onSearch).toHaveBeenCalledWith({ code: "05088" });
  });

  it("warns if the cities could not be loaded", async () => {
    mockFetch({ "/api/catalog/municipalities": failure(500, "Error") });
    render(<Form />);
    await userEvent.selectOptions(screen.getByLabelText("Departamento"), "99");
    await vi.waitFor(() => expect(city()).toHaveDisplayValue("No se pudieron cargar las ciudades"));
    expect(city()).toBeDisabled();
  });

  it("the button is disabled while searching", () => {
    mockFetch();
    render(<Form searching />);
    expect(screen.getByRole("button", { name: "Buscar leads" })).toBeDisabled();
  });
});
