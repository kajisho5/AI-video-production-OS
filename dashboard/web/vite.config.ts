import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// The app lives under /dashboard/ of the GitHub Pages project site
// (https://<user>.github.io/<repository>/dashboard/); the site root is the landing page in site/.
// Override with VITE_BASE_PATH for local dev or a different deployment target.
// In GitHub Actions the path follows the repository's current name (GITHUB_REPOSITORY is
// "<owner>/<name>"), so renaming the repository does not break the deployed dashboard.
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base = process.env.VITE_BASE_PATH ?? `/${repoName ?? "Velisa"}/dashboard/`;

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
        name: "Velisa — Ecosystem dashboard",
        short_name: "Ecosystem",
        description: "A read-only view of the real GitHub state of the Velisa ecosystem.",
        lang: "en",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#101114",
        theme_color: "#101114",
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
      "@ecosystem/control-room-types": new URL("../control-room/src/types.ts", import.meta.url).pathname,
    },
  },
  build: {
    // Second entry point: the Ecosystem Control Room is a separate page
    // (/control-room/), never merged into or replacing the existing Dashboard's
    // own index.html / App.tsx.
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        controlRoom: resolve(import.meta.dirname, "control-room.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
