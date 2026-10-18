import type { Config } from "@react-router/dev/config";

export default {
  // The skill's structure lives in src/ (not in app/).
  appDirectory: "src",
  // Internal tool: the data depends on the user's session and the database, so it is loaded
  // in the browser (clientLoader). Pages are pre-rendered at build time as a shell.
  ssr: false,
  prerender: ["/", "/login", "/contacted", "/templates", "/metrics", "/robots.txt"],
} satisfies Config;
