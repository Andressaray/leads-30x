import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { SITE_NAME } from "@/shared/seo/meta";
import { cn } from "@/shared/lib/cn";
import { Avatar, IconoCerrar, IconoSalir } from "@/shared/ui";

export interface NavItem {
  to: string;
  label: string;
  icono?: ReactNode;
}

interface SidebarProps {
  id?: string;
  nav: NavItem[];
  usuario?: { nombre: string; cargo: string };
  onCerrarSesion?: () => void;
  /** En móvil: cierra el panel (botón X y al elegir una sección). */
  onCerrar?: () => void;
}

export function Marca() {
  return (
    <div className="sidebar-marca">
      <span className="sidebar-logo" aria-hidden="true">
        LC
      </span>
      <span>{SITE_NAME}</span>
    </div>
  );
}

export function Sidebar({ id, nav, usuario, onCerrarSesion, onCerrar }: SidebarProps) {
  return (
    <aside id={id} className="sidebar" aria-label="Menú principal">
      <div className="sidebar-cabecera">
        <Marca />
        {onCerrar && (
          <button type="button" className="sidebar-cerrar" onClick={onCerrar} aria-label="Cerrar menú">
            <IconoCerrar />
          </button>
        )}
      </div>

      <nav className="sidebar-nav" aria-label="Secciones">
        {nav.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end
            onClick={onCerrar}
            className={({ isActive }) => cn("sidebar-enlace", isActive && "activo")}
          >
            {item.icono}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {usuario && (
        <div className="sidebar-usuario">
          <Avatar nombre={usuario.nombre} />
          <div className="sidebar-usuario-datos">
            <b title={usuario.nombre}>{usuario.nombre}</b>
            <span>{usuario.cargo}</span>
          </div>
          {onCerrarSesion && (
            <button type="button" className="sidebar-salir" onClick={onCerrarSesion}>
              <IconoSalir />
              <span>Cerrar sesión</span>
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

interface BarraMovilProps {
  /** id del sidebar que abre (para aria-controls). */
  menuId: string;
  abierto: boolean;
  onAbrir: () => void;
  /** true mientras el menú está abierto: la barra queda detrás y no recibe foco. */
  inerte?: boolean;
}

/** Solo en pantallas angostas: botón de menú + marca. El sidebar entra como panel desde la izquierda. */
export function BarraMovil({ menuId, abierto, onAbrir, inerte }: BarraMovilProps) {
  return (
    <header className="barra-movil" inert={inerte}>
      <button
        type="button"
        className="barra-movil-menu"
        aria-label="Abrir menú"
        aria-controls={menuId}
        aria-expanded={abierto}
        onClick={onAbrir}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <Marca />
    </header>
  );
}
