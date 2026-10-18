import { defineConfig } from "vitest/config";

// Config separate from vite.config.ts: the React Router plugin is not loaded in tests
// (components and routes are tested on their own, with createRoutesStub when a router is needed).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    root: ".",
    include: ["__test__/**/*.test.{ts,tsx}"],
    setupFiles: ["./__test__/setup/dom.ts"],
    // Empty API base URL (same origin), like in production.
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
