import { useState } from "react";
import { useFuentes } from "@/modules/fuentes";
import { descargarCsvBusqueda } from "@/modules/leads";
import { mensajeDeError } from "@/shared/lib/http";
import { Aviso, Skeleton } from "@/shared/ui";
import type { ResultadoBusqueda } from "../types";

export function ResumenBusqueda({ resultado }: { resultado: ResultadoBusqueda }) {
  const { resumen: s, municipio, filtros, busquedaId } = resultado;
  const [errorCsv, setErrorCsv] = useState<string | null>(null);
  const { estado: activas } = useFuentes();
  // Solo las fuentes encendidas en "Fuentes".
  const fuentes = Object.entries(s.porFuente).filter(([n]) => activas[n as keyof typeof activas] !== false);
  const errores = fuentes.filter(([, f]) => f?.estado === "error");

  const datos: Array<[string, string | number]> = [
    ["Leads", s.leads],
    ["Nuevos", s.nuevos],
    ["Contactables", s.contactables],
    ["En 2+ fuentes", s.enVariasFuentes],
    ...fuentes.map(([n, f]): [string, string | number] => [
      n.toUpperCase(),
      f?.estado === "ok" ? f.registros : f?.estado === "omitida" ? "no aplica" : "error",
    ]),
  ];

  return (
    <>
      <div className="estado">
        <p style={{ margin: 0 }}>
          {municipio.nombre}, {municipio.departamento} · {filtros.nombre} · búsqueda #{busquedaId} ·{" "}
          <button
            type="button"
            className="btn-enlace"
            onClick={() => descargarCsvBusqueda(busquedaId).catch((err) => setErrorCsv(mensajeDeError(err)))}
          >
            Descargar CSV
          </button>
        </p>
        {errores.length > 0 && (
          <Aviso
            tipo="error"
            className="aviso-compacto"
            titulo={errores.length === 1 ? "Una fuente falló" : `${errores.length} fuentes fallaron`}
            detalles={errores.map(([n, f]) => `${n.toUpperCase()}: ${f?.error ?? ""}`)}
          />
        )}
        {errorCsv && <Aviso tipo="error" className="aviso-compacto" titulo="No se pudo descargar el CSV." detalles={[errorCsv]} />}
      </div>
      <div className="resumen">
        {datos.map(([k, v]) => (
          <div className="dato" key={k}>
            <b>{v}</b>
            <span>{k}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function ResumenSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div className="resumen">
      {Array.from({ length: n }, (_, i) => (
        <div className="dato" key={i}>
          <Skeleton width={38} height={21} style={{ marginBottom: 6 }} />
          <Skeleton width={64} height={10} />
        </div>
      ))}
    </div>
  );
}
