// API pública del módulo leads: tabla paginada, descarga CSV y tipos.
export { LeadsPanel } from "./components/LeadsPanel";
export { LeadsTableSkeleton } from "./components/LeadsTable";
export { descargarCsvBusqueda, LIMITE_TABLA } from "./services/leads.service";
export type { ContactadoPor, FiltrosLeads, Lead, ListadoLeads, NombreFuente, Telefono } from "./types";
