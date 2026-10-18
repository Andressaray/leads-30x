import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

// The only place where URLs are defined: each one points to the route of the module that owns it.
export default [
  route("login", "modules/auth/login-route.tsx"),
  // Everything else requires a session.
  layout("modules/auth/protected-layout.tsx", [
    index("modules/searches/route.tsx"),
    route("contacted", "modules/leads/contacted-route.tsx"),
    route("templates", "modules/templates/route.tsx"),
    route("metrics", "modules/metrics/route.tsx"),
    route("sources", "modules/sources/route.tsx"),
  ]),
  route("robots.txt", "seo/robots.ts"),
] satisfies RouteConfig;
