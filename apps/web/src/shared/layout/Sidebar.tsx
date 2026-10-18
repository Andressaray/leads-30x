import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { SITE_NAME } from "@/shared/seo/meta";
import { cn } from "@/shared/lib/cn";
import { Avatar, CloseIcon, LogoutIcon } from "@/shared/ui";

export interface NavItem {
  to: string;
  label: string;
  icon?: ReactNode;
}

interface SidebarProps {
  id?: string;
  nav: NavItem[];
  user?: { name: string; loaded: string };
  onLogout?: () => void;
  /** On mobile: closes the panel (X button and when choosing a section). */
  onClose?: () => void;
}

export function Brand() {
  return (
    <div className="sidebar-brand">
      <span className="sidebar-logo" aria-hidden="true">
        LC
      </span>
      <span>{SITE_NAME}</span>
    </div>
  );
}

export function Sidebar({ id, nav, user, onLogout, onClose }: SidebarProps) {
  return (
    <aside id={id} className="sidebar" aria-label="Menú principal">
      <div className="sidebar-header">
        <Brand />
        {onClose && (
          <button type="button" className="sidebar-close" onClick={onClose} aria-label="Cerrar menú">
            <CloseIcon />
          </button>
        )}
      </div>

      <nav className="sidebar-nav" aria-label="Secciones">
        {nav.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end
            onClick={onClose}
            className={({ isActive }) => cn("sidebar-link", isActive && "active")}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {user && (
        <div className="sidebar-user">
          <Avatar name={user.name} />
          <div className="sidebar-user-data">
            <b title={user.name}>{user.name}</b>
            <span>{user.loaded}</span>
          </div>
          {onLogout && (
            <button type="button" className="sidebar-logout" onClick={onLogout}>
              <LogoutIcon />
              <span>Cerrar sesión</span>
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

interface MobileBarProps {
  /** id of the sidebar it opens (for aria-controls). */
  menuId: string;
  isOpen: boolean;
  onOpen: () => void;
  /** true while the menu is open: the bar stays behind and does not receive focus. */
  inert?: boolean;
}

/** Only on narrow screens: menu button + brand. The sidebar slides in as a panel from the left. */
export function MobileBar({ menuId, isOpen, onOpen, inert }: MobileBarProps) {
  return (
    <header className="mobile-bar" inert={inert}>
      <button
        type="button"
        className="mobile-bar-menu"
        aria-label="Abrir menú"
        aria-controls={menuId}
        aria-expanded={isOpen}
        onClick={onOpen}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <Brand />
    </header>
  );
}
