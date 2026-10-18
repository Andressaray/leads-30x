// API pública del módulo contacto: panel para contactar un lead, chip de estado, plantillas y tipos.
export { PanelContacto } from "./components/PanelContacto";
export { EstadoChip } from "./components/EstadoChip";
export { CalidadChip } from "./components/CalidadChip";
export { NOMBRE_CALIDAD, NOMBRE_CANAL, NOMBRE_ESTADO } from "./estados";
export { actualizarPlantilla, crearPlantilla, enviarLoteADapta, estadoDapta, listarPlantillas, listarVariables } from "./services/contacto.service";
export type { CalidadLead, Canal, CanalConPermiso, EstadoContacto, EstadoDapta, Plantilla, ResultadoLoteDapta } from "./types";
