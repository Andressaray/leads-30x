// Envoltura de las páginas que piden sesión: si no hay, manda al login (y vuelve después).
import { useEffect, useState } from "react";
import { Navigate, Outlet, redirect, useLocation } from "react-router";
import { BarraMovil, Sidebar, type NavItem } from "@/shared/layout";
import { useSesion } from "@/shared/hooks/use-session";
import { sessionStore } from "@/shared/lib/session-store";
import { cn } from "@/shared/lib/cn";
import { IconoBuscar, IconoContactados, IconoFuentes, IconoMetricas, IconoPlantillas } from "@/shared/ui";
import type { Route } from "./+types/protected-layout";
import { cerrarSesion, NOMBRE_ROL } from "./services/auth.service";

const NAV: NavItem[] = [
  { to: "/", label: "Buscar leads", icono: <IconoBuscar /> },
  { to: "/contactados", label: "Contactados", icono: <IconoContactados /> },
  { to: "/plantillas", label: "Plantillas", icono: <IconoPlantillas /> },
  { to: "/metricas", label: "Métricas", icono: <IconoMetricas /> },
  { to: "/fuentes", label: "Fuentes", icono: <IconoFuentes /> },
];

const MENU_ID = "menu-lateral";
/** Mismo corte que el CSS: por debajo, el sidebar es un panel que se abre con el botón de menú. */
const MOVIL = "(max-width: 860px)";

const aLogin = (ruta: string) => `/login${ruta && ruta !== "/" ? `?volver=${encodeURIComponent(ruta)}` : ""}`;

// Antes de cargar la página (y sus catálogos) revisa que haya sesión.
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  if (!sessionStore.get()) {
    const url = new URL(request.url);
    throw redirect(aLogin(url.pathname + url.search));
  }
  return null;
}

export function HydrateFallback() {
  return <p className="estado">Cargando…</p>;
}

export default function ProtectedLayout() {
  const sesion = useSesion();
  const { pathname, search } = useLocation();

  // Recuerda los filtros de la URL de cada sección (p. ej. ?equipo=1&pagina=2 en Contactados)
  // para que al volver desde el menú quede como la dejaste.
  const [filtrosPorRuta, setFiltrosPorRuta] = useState<Record<string, string>>({});
  if ((filtrosPorRuta[pathname] ?? "") !== search) setFiltrosPorRuta({ ...filtrosPorRuta, [pathname]: search });

  // Menú lateral en móvil: abierto/cerrado. Mientras está abierto, la página de atrás no se desplaza,
  // Escape lo cierra, Tab no se sale del panel y, si la pantalla se agranda (rotar, redimensionar), se cierra solo.
  const [menuAbierto, setMenuAbierto] = useState(false);
  useEffect(() => {
    if (!menuAbierto) return;
    const consulta = window.matchMedia(MOVIL);
    const alCambiar = () => !consulta.matches && setMenuAbierto(false);
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setMenuAbierto(false);
      if (e.key !== "Tab") return;
      // Tab da la vuelta dentro del panel: del último control vuelve al primero (y al revés con Shift).
      const enfocables = [...(document.getElementById(MENU_ID)?.querySelectorAll<HTMLElement>("a[href], button") ?? [])];
      const primero = enfocables[0];
      const ultimo = enfocables.at(-1);
      const actual = document.activeElement;
      if (e.shiftKey ? actual === primero || !enfocables.includes(actual as HTMLElement) : actual === ultimo) {
        e.preventDefault();
        (e.shiftKey ? ultimo : primero)?.focus();
      }
    };
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.getElementById(MENU_ID)?.querySelector<HTMLElement>(".sidebar-enlace.activo, .sidebar-enlace")?.focus();
    consulta.addEventListener("change", alCambiar);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.body.style.overflow = scroll;
      consulta.removeEventListener("change", alCambiar);
      document.removeEventListener("keydown", alTeclear);
      document.querySelector<HTMLElement>(".barra-movil-menu")?.focus({ preventScroll: true });
    };
  }, [menuAbierto]);

  // La sesión se cerró (botón o token vencido): de vuelta al login.
  if (!sesion) return <Navigate to={aLogin(pathname + search)} replace />;

  const nav = NAV.map((item) => ({ ...item, to: item.to + (filtrosPorRuta[item.to] ?? "") }));

  return (
    <div className={cn("app", menuAbierto && "menu-abierto")}>
      <BarraMovil menuId={MENU_ID} abierto={menuAbierto} inerte={menuAbierto} onAbrir={() => setMenuAbierto(true)} />
      <Sidebar
        id={MENU_ID}
        nav={nav}
        usuario={{ nombre: sesion.usuario.fullName, cargo: NOMBRE_ROL[sesion.usuario.rol] }}
        onCerrarSesion={cerrarSesion}
        onCerrar={() => setMenuAbierto(false)}
      />
      <div className="sidebar-fondo" aria-hidden="true" onClick={() => setMenuAbierto(false)} />
      {/* Con el menú abierto en móvil, lo de atrás no recibe foco ni clics. */}
      <main className="app-main" inert={menuAbierto}>
        <div className="app-contenido">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
