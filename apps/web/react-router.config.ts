import type { Config } from "@react-router/dev/config";

export default {
  // La estructura de la skill vive en src/ (no en app/).
  appDirectory: "src",
  // Herramienta interna: los datos dependen de la sesión del usuario y de la base, así que se cargan
  // en el navegador (clientLoader). Las páginas se pre-renderizan en build como cascarón.
  ssr: false,
  prerender: ["/", "/login", "/contactados", "/plantillas", "/metricas", "/robots.txt"],
} satisfies Config;
