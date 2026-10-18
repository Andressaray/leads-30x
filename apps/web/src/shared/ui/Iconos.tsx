// Íconos de trazo (18 px) para el menú lateral. Heredan el color del texto.
import type { ReactNode } from "react";

function Icono({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconoBuscar = () => (
  <Icono>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icono>
);

export const IconoContactados = () => (
  <Icono>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 3.5 1.1" />
    <path d="m15 18 2 2 4-4" />
  </Icono>
);

export const IconoEquipo = () => (
  <Icono>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20v-.5A5.5 5.5 0 0 1 8 14h2a5.5 5.5 0 0 1 5.5 5.5v.5" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
    <path d="M18.5 14a5 5 0 0 1 3 4.6v1.4" />
  </Icono>
);

export const IconoPlantillas = () => (
  <Icono>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Icono>
);

export const IconoMetricas = () => (
  <Icono>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-4 3 3 5-6" />
  </Icono>
);

export const IconoFuentes = () => (
  <Icono>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
    <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  </Icono>
);

export const IconoCerrar = () => (
  <Icono>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icono>
);

export const IconoSalir = () => (
  <Icono>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Icono>
);
