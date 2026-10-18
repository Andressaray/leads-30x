import type { ReactNode } from "react";

interface AvisoProps {
  tipo: "error" | "info";
  titulo: ReactNode;
  detalles?: ReactNode[];
  children?: ReactNode;
  className?: string;
}

export function Aviso({ tipo, titulo, detalles = [], children, className }: AvisoProps) {
  return (
    <div className={`aviso aviso-${tipo}${className ? ` ${className}` : ""}`} role={tipo === "error" ? "alert" : "status"}>
      <span className="aviso-icono" aria-hidden>
        {tipo === "error" ? "⚠" : "⏳"}
      </span>
      <div>
        <div className="aviso-titulo">{titulo}</div>
        {children}
        {detalles.length > 0 && (
          <ul className="aviso-detalles">
            {detalles.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
