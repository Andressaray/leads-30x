import { useState } from "react";
import { PanelContacto } from "@/modules/contacto";
import { EnvioDapta } from "./EnvioDapta";
import { Aviso } from "@/shared/ui";
import { useLeads } from "../hooks/use-leads";
import type { FiltrosLeads } from "../types";
import type { VarianteTabla } from "./LeadRow";
import { LeadsTable, LeadsTableSkeleton } from "./LeadsTable";
import { Paginador } from "./Paginador";

/** Tabla de leads paginada con su estado de carga, error y vacío. */
interface LeadsPanelProps {
  filtros: FiltrosLeads;
  variante?: VarianteTabla;
  /** Texto cuando no hay leads. */
  vacio?: string;
  /** Página controlada desde afuera; sin valor, la tabla la maneja sola. */
  pagina?: number;
  onCambiarPagina?: (pagina: number) => void;
  /** Muestra el botón para mandar a Dapta los leads de la página. */
  envioDapta?: boolean;
}

export function LeadsPanel({
  filtros,
  variante = "busqueda",
  vacio = "No hay leads para mostrar todavía.",
  pagina,
  onCambiarPagina,
  envioDapta = false,
}: LeadsPanelProps) {
  const { cargando, datos, error, setPagina, recargar } = useLeads(filtros, { pagina, onCambiarPagina });
  // Lead con el panel de contacto abierto.
  const [abierto, setAbierto] = useState<number | null>(null);

  return (
    <>
      {error && (
        <div className="estado">
          <Aviso tipo="error" titulo="No se pudieron cargar los leads." detalles={[error]} />
        </div>
      )}
      {/* Fuera del "cargando": así el resultado del envío sigue a la vista mientras la tabla se refresca. */}
      {envioDapta && datos && datos.leads.length > 0 && <EnvioDapta leads={datos.leads} onEnviados={recargar} />}
      {cargando && <LeadsTableSkeleton variante={variante} filas={Math.min(datos?.leads.length || 6, 10)} />}
      {!cargando && datos && datos.leads.length === 0 && <p className="vacio">{vacio}</p>}
      {!cargando && datos && datos.leads.length > 0 && (
        <>
          <LeadsTable leads={datos.leads} variante={variante} onAbrir={setAbierto} />
          <Paginador total={datos.total} pagina={datos.pagina} limite={datos.limite} onCambiar={setPagina} />
        </>
      )}
      {abierto !== null && (
        <PanelContacto
          leadId={abierto}
          onCerrar={(huboCambios) => {
            setAbierto(null);
            if (huboCambios) recargar();
          }}
        />
      )}
    </>
  );
}
