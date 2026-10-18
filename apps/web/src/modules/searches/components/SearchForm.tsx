import type { FormEvent } from "react";
import { useMunicipalities, type Category, type Department } from "@/modules/catalog";
import type { SearchFormValues } from "../hooks/use-search";
import type { CreateSearch } from "../types";

interface SearchFormProps {
  categories: Category[];
  departments: Department[];
  /** Form values (controlled from outside so they are not lost when changing sections). */
  values: SearchFormValues;
  onChange: (changes: Partial<SearchFormValues>) => void;
  searching: boolean;
  /** true = there are no active sources: searching is not possible. */
  blocked?: boolean;
  onSearch: (data: CreateSearch) => void;
}

export function SearchForm({ categories, departments, values, onChange, searching, blocked, onSearch }: SearchFormProps) {
  const { department, code, category } = values;
  const municipalities = useMunicipalities(department);

  function send(e: FormEvent) {
    e.preventDefault();
    onSearch({ code, ...(category ? { category } : {}) });
  }

  const cityText = {
    "no-department": "Elige primero el departamento",
    loading: "Cargando…",
    error: "No se pudieron cargar las ciudades",
    ready: "Elige una ciudad…",
  }[municipalities.status];

  return (
    <form onSubmit={send}>
      <label>
        Departamento
        <select
          required
          value={department}
          onChange={(e) => onChange({ department: e.target.value, code: "" })}
        >
          <option value="">Elige un departamento…</option>
          {departments.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Ciudad
        <select required disabled={municipalities.status !== "ready"} value={code} onChange={(e) => onChange({ code: e.target.value })}>
          <option value="">{cityText}</option>
          {municipalities.status === "ready" &&
            municipalities.municipalities.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Categoría
        <select value={category} onChange={(e) => onChange({ category: e.target.value })}>
          <option value="">Todos los negocios</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <button className="btn-primary" disabled={searching || blocked}>
        Buscar leads
      </button>
    </form>
  );
}
