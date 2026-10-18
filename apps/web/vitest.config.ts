import { defineConfig } from "vitest/config";

// Config aparte de vite.config.ts: el plugin de React Router no se carga en las pruebas
// (los componentes y rutas se prueban sueltos, con createRoutesStub cuando hace falta router).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    root: ".",
    include: ["__test__/**/*.test.{ts,tsx}"],
    setupFiles: ["./__test__/setup/dom.ts"],
    // La URL base de la API vacía (mismo origen), como en producción.
    env: { VITE_API_URL: "" },
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/types.ts", "src/**/index.ts", "src/vite-env.d.ts", "src/routes.ts", "src/root.tsx"],
      reporter: ["text", "html"],
    },
  },
});
