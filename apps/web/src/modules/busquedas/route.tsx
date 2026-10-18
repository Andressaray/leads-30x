import { getCategorias, getDepartamentos } from "@/modules/catalogo";
import { listaNombres, useFuentes } from "@/modules/fuentes";
import { LeadsPanel, LeadsTableSkeleton } from "@/modules/leads";
import { Link } from "react-router";
import { apiUrl, mensajeDeError } from "@/shared/lib/http";
import { buildMeta } from "@/shared/seo/meta";
import { Aviso } from "@/shared/ui";
import type { Route } from "./+types/route";
import { BusquedaForm } from "./components/BusquedaForm";
import { ResumenBusqueda, ResumenSkeleton } from "./components/ResumenBusqueda";
import { useBusqueda } from "./hooks/use-busqueda";

export const meta = () => buildMeta({ title: "Buscar leads" });

// Catálogos del formulario. Corre en el navegador porque depende de la sesión del usuario.
export async function clientLoader() {
  const [categorias, departamentos] = await Promise.allSettled([getCategorias(), getDepartamentos()]);
  const fallo = [categorias, departamentos].find((r) => r.status === "rejected");
  return {
    categorias: categorias.status === "fulfilled" ? categorias.value : [],
    departamentos: departamentos.status === "fulfilled" ? departamentos.value : [],
    errorCatalogo: fallo ? mensajeDeError(fallo.reason) : null,
  };
}

export function HydrateFallback() {
  return <p className="estado">Cargando catálogos…</p>;
}

export default function BuscarPage({ loaderData }: Route.ComponentProps) {
  const { categorias, departamentos, errorCatalogo } = loaderData;
  const { form, busqueda, pagina, buscar, setForm, setPagina } = useBusqueda();
  const { activas } = useFuentes();
  const nombres = listaNombres(activas.map((f) => f.nombre));

  return (
    <section>
      <header className="pagina-cabecera">
        <h1>Buscar leads</h1>
        <p className="sub">
          Elige el departamento y la ciudad, y el servidor busca negocios en {activas.length > 0 ? nombres : "las fuentes activas"}, los cruza y
          los guarda sin duplicados. <Link to="/fuentes">Elegir fuentes</Link> ·{" "}
          <a href={apiUrl("/api/docs")} target="_blank" rel="noreferrer">
            Documentación de la API
          </a>
        </p>
      </header>

      <BusquedaForm
        categorias={categorias}
        departamentos={departamentos}
        valores={form}
        onCambiar={setForm}
        buscando={busqueda.estado === "buscando"}
        bloqueado={activas.length === 0}
        onBuscar={buscar}
      />

      {activas.length === 0 && (
        <div className="estado">
          <Aviso tipo="info" titulo="No hay fuentes activas.">
            Activa al menos una en <Link to="/fuentes">Fuentes</Link> para poder buscar.
          </Aviso>
        </div>
      )}

      {errorCatalogo && (
        <div className="estado">
          <Aviso tipo="error" titulo="No se pudieron cargar los catálogos." detalles={[errorCatalogo]} />
        </div>
      )}

      {busqueda.estado === "buscando" && (
        <>
          <div className="estado">
            <Aviso tipo="info" titulo="Buscando leads…">
              {nombres}. Si ya buscaste esta ciudad y categoría hoy, sale en segundos; si no, puede tardar uno o dos minutos.
            </Aviso>
          </div>
          <ResumenSkeleton />
          <LeadsTableSkeleton />
        </>
      )}

      {busqueda.estado === "error" && (
        <div className="estado">
          <Aviso tipo="error" titulo={busqueda.titulo} detalles={busqueda.detalles} />
        </div>
      )}

      {busqueda.estado === "lista" && (
        <>
          <ResumenBusqueda resultado={busqueda.resultado} />
          <LeadsPanel filtros={{ busqueda: busqueda.resultado.busquedaId }} pagina={pagina} onCambiarPagina={setPagina} />
        </>
      )}
    </section>
  );
}
