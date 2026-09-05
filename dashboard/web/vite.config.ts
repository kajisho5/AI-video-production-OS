import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// base is set for GitHub Pages project-site hosting (https://<user>.github.io/AI-video-production-OS/).
// Override with VITE_BASE_PATH for local dev or a different deployment target.
const base = process.env.VITE_BASE_PATH ?? "/AI-video-production-OS/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Deliberately minimal per the task's own instruction ("do not over-engineer PWA
      // functionality in v1"): cache the built app shell so it opens instantly and
      // works offline showing the last snapshot it saw; never cache the data JSON
      // itself with a cache-first strategy, since a stale ecosystem snapshot silently
      // served as if current would violate this project's "never invent/imply
      // freshness" rule -- network-first with a short timeout instead, so a viewer
      // offline still sees the last real snapshot (clearly timestamped), not a
      // fabricated one.
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        runtimeCaching: [
          {
            urlPattern: /\/data\/ecosystem-snapshot\.json$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "ecosystem-snapshot",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 2 },
            },
          },
        ],
      },
      manifest: {
        name: "AI Video Production OS — エコシステムダッシュボード",
        short_name: "エコシステム",
        description: "AI Video Production OS エコシステムの実際のGitHub状態を映す、読み取り専用の観測レイヤー。",
        lang: "ja",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#0a0d12",
        theme_color: "#0a0d12",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@ecosystem/types": new URL("../shared/types.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
