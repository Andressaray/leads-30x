// Wrapper of the pages that require a session: without one, it sends you to login (and back afterwards).
import { useEffect, useState } from "react";
import { Navigate, Outlet, redirect, useLocation } from "react-router";
import { MobileBar, Sidebar, type NavItem } from "@/shared/layout";
import { useSession } from "@/shared/hooks/use-session";
import { sessionStore } from "@/shared/lib/session-store";
import { cn } from "@/shared/lib/cn";
import { SearchIcon, ContactedIcon, SourcesIcon, MetricsIcon, TemplatesIcon } from "@/shared/ui";
import type { Route } from "./+types/protected-layout";
import { logout, ROLE_NAME } from "./services/auth.service";

const NAV: NavItem[] = [
  { to: "/", label: "Buscar leads", icon: <SearchIcon /> },
  { to: "/contacted", label: "Contactados", icon: <ContactedIcon /> },
  { to: "/templates", label: "Plantillas", icon: <TemplatesIcon /> },
  { to: "/metrics", label: "Métricas", icon: <MetricsIcon /> },
  { to: "/sources", label: "Fuentes", icon: <SourcesIcon /> },
];

const MENU_ID = "menu-lateral";
/** Same breakpoint as the CSS: below it, the sidebar is a panel opened with the menu button. */
const MOBILE = "(max-width: 860px)";

const toLogin = (route: string) => `/login${route && route !== "/" ? `?returnTo=${encodeURIComponent(route)}` : ""}`;

// Before loading the page (and its catalogs) it checks that there is a session.
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  if (!sessionStore.get()) {
    const url = new URL(request.url);
    throw redirect(toLogin(url.pathname + url.search));
  }
  return null;
}

export function HydrateFallback() {
  return <p className="status">Cargando…</p>;
}

export default function ProtectedLayout() {
  const session = useSession();
  const { pathname, search } = useLocation();

  // Remembers each section's URL filters (e.g. ?team=1&page=2 in Contacted)
  // so that coming back from the menu leaves it as you left it.
  const [filtersByRoute, setFiltersByRoute] = useState<Record<string, string>>({});
  if ((filtersByRoute[pathname] ?? "") !== search) setFiltersByRoute({ ...filtersByRoute, [pathname]: search });

  // Mobile side menu: open/closed. While open, the page behind does not scroll,
  // Escape closes it, Tab does not leave the panel and, if the screen gets wider (rotate, resize), it closes on its own.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const query = window.matchMedia(MOBILE);
    const onChange = () => !query.matches && setMenuOpen(false);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setMenuOpen(false);
      if (e.key !== "Tab") return;
      // Tab wraps around inside the panel: from the last control it goes back to the first (and the other way with Shift).
      const focusable = [...(document.getElementById(MENU_ID)?.querySelectorAll<HTMLElement>("a[href], button") ?? [])];
      const first = focusable[0];
      const last = focusable.at(-1);
      const current = document.activeElement;
      if (e.shiftKey ? current === first || !focusable.includes(current as HTMLElement) : current === last) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
      }
    };
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.getElementById(MENU_ID)?.querySelector<HTMLElement>(".sidebar-link.active, .sidebar-link")?.focus();
    query.addEventListener("change", onChange);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = scroll;
      query.removeEventListener("change", onChange);
      document.removeEventListener("keydown", onKeyDown);
      document.querySelector<HTMLElement>(".mobile-bar-menu")?.focus({ preventScroll: true });
    };
  }, [menuOpen]);

  // The session was closed (button or expired token): back to login.
  if (!session) return <Navigate to={toLogin(pathname + search)} replace />;

  const nav = NAV.map((item) => ({ ...item, to: item.to + (filtersByRoute[item.to] ?? "") }));

  return (
    <div className={cn("app", menuOpen && "menu-open")}>
      <MobileBar menuId={MENU_ID} isOpen={menuOpen} inert={menuOpen} onOpen={() => setMenuOpen(true)} />
      <Sidebar
        id={MENU_ID}
        nav={nav}
        user={{ name: session.user.fullName, loaded: ROLE_NAME[session.user.role] }}
        onLogout={logout}
        onClose={() => setMenuOpen(false)}
      />
      <div className="sidebar-backdrop" aria-hidden="true" onClick={() => setMenuOpen(false)} />
      {/* Con el menú abierto en móvil, lo de atrás no recibe foco ni clics. */}
      <main className="app-main" inert={menuOpen}>
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
