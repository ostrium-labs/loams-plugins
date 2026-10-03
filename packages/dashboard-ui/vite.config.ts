import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, lazyPlugins } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const coreUiSource = fileURLToPath(new URL("../core/src/ui/index.ts", import.meta.url));
const coreWorkspaceLink = fileURLToPath(
  new URL("../../node_modules/@loams-plugins/core", import.meta.url),
);

/**
 * `@loams-plugins/core` publishes its shell at the `@loams-plugins/core/ui` subpath. Until the
 * workspace symlink for `@loams-plugins/core` exists (it appears on the next
 * `npm install` after the package is published), resolve that subpath straight
 * to the source so this app still builds and the dev server still hot-reloads
 * the shell.
 *
 * This alias disappears on its own the moment `@loams-plugins/core` is installed: it is
 * only used when the real package cannot be found.
 */
/*
 * Annotated rather than inferred: the ternary's two branches have different
 * shapes, and TypeScript widens the union to
 * `{ "@loams-plugins/core/ui"?: undefined } | { "@loams-plugins/core/ui": string }`, which is not
 * assignable to Vite's `AliasOptions`.
 */
const coreUiAlias: Record<string, string> = existsSync(coreWorkspaceLink)
  ? {}
  : { "@loams-plugins/core/ui": coreUiSource };

// https://vitejs.dev/config/
export default defineConfig({
  /*
   * Tailwind v4 is CSS-first: no `tailwind.config.js` anywhere. Tokens live in
   * the `@theme` block at the top of `src/styles.css`, and the component
   * layer is expressed as utilities in the TSX rather than as classes here.
   */
  plugins: lazyPlugins(() => [react(), tailwindcss()]),
  resolve: {
    alias: coreUiAlias,
  },
  /*
   * The shell owns the client-side routes `/`, `/plugins`, `/console` and
   * `/plugins/:id`, so a hard refresh or a pasted deep link has to be answered
   * with index.html instead of a 404. `spa` is Vite's default; setting it
   * explicitly keeps the history fallback correct if a preset or a future
   * `custom` appType is ever introduced here.
   */
  appType: "spa",
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
