import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { webAppManifest } from "./src/pwa/manifest";

export default defineConfig({
  base: "./",
  server: {
    headers: {
      "Cache-Control": "no-store",
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: webAppManifest,
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        globIgnores: ["og.png"],
      },
    }),
  ],
  build: { target: "es2020", sourcemap: false },
});
