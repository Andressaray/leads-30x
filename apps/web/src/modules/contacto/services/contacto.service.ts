import { http, request } from "@/shared/lib/http";
import type {
  CalidadLead,
  Calificacion,
  Canal,
  CanalConPermiso,
  EstadoDapta,
  FichaContacto,
  Interaccion,
  LeadContacto,
  MensajePreparado,
  Plantilla,
  ResultadoLoteDapta,
  ResultadoRespuesta,
} from "../types";

interface Resultado {
  interaccion: Interaccion;
  lead: LeadContacto;
}

export const obtenerFicha = (leadId: number, signal?: AbortSignal) => http.get<FichaContacto>(`/api/leads/${leadId}/contacto`, undefined, signal);

export const vistaPrevia = (leadId: number, datos: { plantillaId?: number; asunto?: string; cuerpo?: string }) =>
  http.post<MensajePreparado>(`/api/leads/${leadId}/contacto/vista-previa`, datos);

export const enviarCorreo = (leadId: number, datos: { para: string; asunto: string; mensaje: string; plantillaId?: number }) =>
  http.post<Resultado>(`/api/leads/${leadId}/correo`, datos);

export const registrarContacto = (
  leadId: number,
  datos: { canal: Exclude<Canal, "EMAIL">; destino?: string; mensaje?: string; nota?: string; plantillaId?: number },
) => http.post<Resultado>(`/api/leads/${leadId}/interacciones`, datos);

export const registrarRespuesta = (leadId: number, datos: { canal: Canal; resultado: ResultadoRespuesta; nota?: string }) =>
  http.post<Resultado>(`/api/leads/${leadId}/respuesta`, datos);

export const marcarNoContactar = (leadId: number, nota?: string) => http.post<LeadContacto>(`/api/leads/${leadId}/no-contactar`, { nota });

export const listarPlantillas = (canal?: CanalConPermiso, inactivas = false) =>
  http.get<Plantilla[]>("/api/plantillas", { canal, inactivas: inactivas || undefined });

export const crearPlantilla = (datos: { nombre: string; canal: CanalConPermiso; asunto?: string; cuerpo: string }) =>
  http.post<Plantilla>("/api/plantillas", datos);

export const actualizarPlantilla = (id: number, datos: Partial<Pick<Plantilla, "nombre" | "asunto" | "cuerpo" | "activa">>) =>
  request<Plantilla>(`/api/plantillas/${id}`, { method: "PATCH", body: datos });

export const listarVariables = () => http.get<{ nombre: string; descripcion: string }[]>("/api/plantillas/variables");

// Calificación con Dapta (punto 4)
export const estadoDapta = () => http.get<EstadoDapta>("/api/dapta/estado");
export const listarCalificaciones = (leadId: number) => http.get<Calificacion[]>(`/api/leads/${leadId}/calificaciones`);
export const enviarADapta = (leadId: number) => http.post<Calificacion>(`/api/leads/${leadId}/dapta`);
export const enviarLoteADapta = (leadIds: number[]) => http.post<ResultadoLoteDapta>("/api/dapta/envios", { leadIds });
export const calificarManual = (leadId: number, datos: { calidad: CalidadLead; puntaje?: number; nota?: string }) =>
  http.post<Calificacion>(`/api/leads/${leadId}/calificacion`, datos);
