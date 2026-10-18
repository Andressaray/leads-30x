import { getCategories, getDepartments } from "@/modules/catalog";
import { namesList, useSources } from "@/modules/sources";
import { LeadsPanel, LeadsTableSkeleton } from "@/modules/leads";
import { Link } from "react-router";
import { apiUrl, errorMessage } from "@/shared/lib/http";
import { buildMeta } from "@/shared/seo/meta";
import { Notice } from "@/shared/ui";
import type { Route } from "./+types/route";
import { SearchForm } from "./components/SearchForm";
import { SearchSummary, SummarySkeleton } from "./components/SearchSummary";
import { useSearch } from "./hooks/use-search";

export const meta = () => buildMeta({ title: "Buscar leads" });

// Form catalogs. It runs in the browser because it depends on the user's session.
export async function clientLoader() {
  const [categories, departments] = await Promise.allSettled([getCategories(), getDepartments()]);
  const failed = [categories, departments].find((r) => r.status === "rejected");
  return {
    categories: categories.status === "fulfilled" ? categories.value : [],
    departments: departments.status === "fulfilled" ? departments.value : [],
    catalogError: failed ? errorMessage(failed.reason) : null,
  };
}

export function HydrateFallback() {
  return <p className="status">Cargando catálogos…</p>;
}

export default function SearchPage({ loaderData }: Route.ComponentProps) {
  const { categories, departments, catalogError } = loaderData;
  const { form, search, page, runSearch, setForm, setPage } = useSearch();
  const { active } = useSources();
  const names = namesList(active.map((f) => f.name));

  return (
    <section>
      <header className="page-header">
        <h1>Buscar leads</h1>
        <p className="sub">
          Elige el departamento y la ciudad, y el servidor busca negocios en {active.length > 0 ? names : "las fuentes activas"}, los cruza y
          los guarda sin duplicados. <Link to="/sources">Elegir fuentes</Link> ·{" "}
          <a href={apiUrl("/api/docs")} target="_blank" rel="noreferrer">
            Documentación de la API
          </a>
        </p>
      </header>

      <SearchForm
        categories={categories}
        departments={departments}
        values={form}
        onChange={setForm}
        searching={search.status === "searching"}
        blocked={active.length === 0}
        onSearch={runSearch}
      />

      {active.length === 0 && (
        <div className="status">
          <Notice type="info" title="No hay fuentes activas.">
            Activa al menos una en <Link to="/sources">Fuentes</Link> para poder buscar.
          </Notice>
        </div>
      )}

      {catalogError && (
        <div className="status">
          <Notice type="error" title="No se pudieron cargar los catálogos." details={[catalogError]} />
        </div>
      )}

      {search.status === "searching" && (
        <>
          <div className="status">
            <Notice type="info" title="Buscando leads…">
              {names}. Si ya buscaste esta ciudad y categoría hoy, sale en segundos; si no, puede tardar uno o dos minutos.
            </Notice>
          </div>
          <SummarySkeleton />
          <LeadsTableSkeleton />
        </>
      )}

      {search.status === "error" && (
        <div className="status">
          <Notice type="error" title={search.title} details={search.details} />
        </div>
      )}

      {search.status === "list" && (
        <>
          <SearchSummary result={search.result} />
          <LeadsPanel filters={{ search: search.result.searchId }} page={page} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}
