import type { FormEvent } from "react";
import { useMunicipios, type Categoria, type Departamento } from "@/modules/catalogo";
import type { FormBusqueda } from "../hooks/use-busqueda";
import type { CrearBusqueda } from "../types";

interface BusquedaFormProps {
  categorias: Categoria[];
  departamentos: Departamento[];
  /** Valores del formulario (controlados desde afuera para que no se pierdan al cambiar de sección). */
  valores: FormBusqueda;
  onCambiar: (cambios: Partial<FormBusqueda>) => void;
  buscando: boolean;
  /** true = no hay fuentes activas: no se puede buscar. */
  bloqueado?: boolean;
  onBuscar: (datos: CrearBusqueda) => void;
}

export function BusquedaForm({ categorias, departamentos, valores, onCambiar, buscando, bloqueado, onBuscar }: BusquedaFormProps) {
  const { departamento, codigo, categoria } = valores;
  const municipios = useMunicipios(departamento);

  function enviar(e: FormEvent) {
    e.preventDefault();
    onBuscar({ codigo, ...(categoria ? { categoria } : {}) });
  }

  const textoCiudad = {
    "sin-departamento": "Elige primero el departamento",
    cargando: "Cargando…",
    error: "No se pudieron cargar las ciudades",
    listo: "Elige una ciudad…",
  }[municipios.estado];

  return (
    <form onSubmit={enviar}>
      <label>
        Departamento
        <select
          required
          value={departamento}
          onChange={(e) => onCambiar({ departamento: e.target.value, codigo: "" })}
        >
          <option value="">Elige un departamento…</option>
          {departamentos.map((d) => (
            <option key={d.codigo} value={d.codigo}>
              {d.nombre}
            </option>
          ))}
        </select>
      </label>
      <label>
        Ciudad
        <select required disabled={municipios.estado !== "listo"} value={codigo} onChange={(e) => onCambiar({ codigo: e.target.value })}>
          <option value="">{textoCiudad}</option>
          {municipios.estado === "listo" &&
            municipios.municipios.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nombre}
              </option>
            ))}
        </select>
      </label>
      <label>
        Categoría
        <select value={categoria} onChange={(e) => onCambiar({ categoria: e.target.value })}>
          <option value="">Todos los negocios</option>
          {categorias.map((c) => (
            <option key={c.clave} value={c.clave}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <button className="btn-primario" disabled={buscando || bloqueado}>
        Buscar leads
      </button>
    </form>
  );
}
