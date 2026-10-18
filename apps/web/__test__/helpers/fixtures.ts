import type { Lead } from "@/modules/leads";
import type { ResultadoBusqueda } from "@/modules/busquedas";
import type { Sesion } from "@/shared/lib/session-store";

export const sesion = (cambios: Partial<Sesion["usuario"]> = {}): Sesion => ({
  token: "token-de-prueba",
  usuario: { id: 7, email: "andres@leads.co", fullName: "Andrés Saray", rol: "SERVICE", ...cambios },
});

let siguienteId = 1;

export function lead(cambios: Partial<Lead> = {}): Lead {
  const id = cambios.id ?? siguienteId++;
  return {
    id,
    nombre: `Negocio ${id}`,
    razonSocial: null,
    nit: null,
    municipio: "Medellín",
    departamento: "Antioquia",
    direccion: null,
    telefonos: [],
    emails: [],
    sitiosWeb: [],
    redes: [],
    contactable: true,
    fuentes: ["osm"],
    ...cambios,
  };
}

export function resultadoBusqueda(cambios: Partial<ResultadoBusqueda> = {}): ResultadoBusqueda {
  return {
    busquedaId: 42,
    estado: "completa",
    municipio: { codigo: "05001", nombre: "Medellín", departamento: "Antioquia" },
    filtros: { nombre: "Restaurantes", categoria: "restaurantes" },
    resumen: {
      leads: 120,
      nuevos: 30,
      contactables: 80,
      enVariasFuentes: 15,
      porFuente: {
        dane: { estado: "ok", registros: 70, nuevos: 20, enriquecidos: 5, error: null },
        osm: { estado: "ok", registros: 50, nuevos: 10, enriquecidos: 3, error: null },
      },
    },
    leadsTotal: 120,
    leads: [],
    ...cambios,
  };
}
