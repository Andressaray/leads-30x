import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // In development, /api and /health go to the local API (apps/api).
  const api = env.API_PROXY_TARGET || "http://localhost:3000";

  return {
    plugins: [reactRouter()],
    resolve: { tsconfigPaths: true },
    server: {
      port: 5173,
      proxy: {
        "/api": { target: api, changeOrigin: true },
        "/health": { target: api, changeOrigin: true },
      },
    },
  };
});
