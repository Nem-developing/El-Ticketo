import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// En développement, les appels /api sont relayés vers l'API (même origine, pas de CORS).
// L'hôte d'origine est conservé, comme derrière Traefik : l'API en déduit ses liens (retour SSO).
const apiProxy = {
  "/api": { target: process.env.API_URL ?? "http://localhost:8080", changeOrigin: false },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    restoreMocks: true,
  },
});
