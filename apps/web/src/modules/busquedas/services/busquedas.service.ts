import { ApiError, http } from "@/shared/lib/http";
import type { BusquedaGuardada, CrearBusqueda, InicioBusqueda, ResultadoBusqueda } from "../types";

const INTERVALO_MS = 2000;
/** Más que el peor caso de la API (todas las fuentes con su tope de espera) más algo de cola. */
const ESPERA_MAXIMA_MS = 10 * 60 * 1000;

const pausa = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });

function aResultado(b: BusquedaGuardada): ResultadoBusqueda {
  const resumen = b.resumen ?? { leads: 0, nuevos: 0, contactables: 0, enVariasFuentes: 0, porFuente: {} };
  return {
    busquedaId: b.id,
    estado: b.estado,
    municipio: { codigo: b.codMpio, nombre: b.municipio, departamento: b.departamento },
    filtros: b.filtros,
    resumen,
    leadsTotal: resumen.leads,
    leads: [],
  };
}

/**
 * Lanza la búsqueda en las cinco fuentes. La API responde de inmediato (202) y
 * la procesa en segundo plano; aquí se consulta su estado hasta que termine.
 */
export async function crearBusqueda(datos: CrearBusqueda, signal?: AbortSignal): Promise<ResultadoBusqueda> {
  const inicio = await http.post<InicioBusqueda>("/api/busquedas", { ...datos, asincrona: true });
  const limite = Date.now() + ESPERA_MAXIMA_MS;

  for (;;) {
    await pausa(INTERVALO_MS, signal);
    const b = await http.get<BusquedaGuardada>(`/api/busquedas/${inicio.busquedaId}`, undefined, signal);
    if (b.estado === "fallida") {
      const porFuente = b.resumen?.porFuente ?? {};
      throw new ApiError(502, "Ninguna fuente respondió. Intenta de nuevo en unos minutos.", { porFuente });
    }
    if (b.estado !== "en_curso") return aResultado(b);
    if (Date.now() > limite) {
      throw new ApiError(504, `La búsqueda #${inicio.busquedaId} sigue en curso. Revísala más tarde en el historial.`);
    }
  }
}
