import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

// Único lugar donde se definen las URLs: cada una apunta al route del módulo dueño.
export default [
  route("login", "modules/auth/login-route.tsx"),
  // Todo lo demás pide sesión.
  layout("modules/auth/protected-layout.tsx", [
    index("modules/busquedas/route.tsx"),
    route("contactados", "modules/leads/contactados-route.tsx"),
    route("plantillas", "modules/plantillas/route.tsx"),
    route("metricas", "modules/metricas/route.tsx"),
    route("fuentes", "modules/fuentes/route.tsx"),
  ]),
  route("robots.txt", "seo/robots.ts"),
] satisfies RouteConfig;
