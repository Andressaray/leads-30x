import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { ReactNode } from "react";
import type { Route } from "./+types/root";
import { Container } from "@/shared/layout";
import { SITE_NAME } from "@/shared/seo/meta";
import "@/shared/styles/app.css";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Cada página decide su marco: el login va centrado y las páginas con sesión llevan el menú lateral.
export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let titulo = "Algo salió mal";
  let detalle = "Ocurrió un error inesperado.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    titulo = error.status === 404 ? "Página no encontrada" : `Error ${error.status}`;
    detalle = error.status === 404 ? "La página que buscas no existe." : error.statusText || detalle;
  } else if (import.meta.env.DEV && error instanceof Error) {
    detalle = error.message;
    stack = error.stack;
  }

  return (
    <Container>
      <h1>{SITE_NAME}</h1>
      <h2>{titulo}</h2>
      <p>{detalle}</p>
      {stack && (
        <pre style={{ overflowX: "auto" }}>
          <code>{stack}</code>
        </pre>
      )}
    </Container>
  );
}
