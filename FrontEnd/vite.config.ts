import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// En développement, les appels /api sont relayés vers l'API (même origine, pas de CORS).
const apiUrl = process.env.API_URL ?? "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: { "/api": apiUrl },
  },
  preview: {
    proxy: { "/api": apiUrl },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    restoreMocks: true,
  },
});
