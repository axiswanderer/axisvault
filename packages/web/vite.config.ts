import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// When building for the Electron desktop shell (which loads index.html via
// file://, not http://), asset paths MUST be relative — an absolute path
// like "/assets/app.js" resolves against the filesystem root under file://
// and produces a blank window. The regular web deployment (served from a
// real domain) wants the default absolute base. ELECTRON_BUILD is set by
// the desktop package's build:renderer script.
const isElectronBuild = process.env.ELECTRON_BUILD === "true";

// Vite adds a `crossorigin` attribute to module <script>/<link> tags by
// default — correct and desirable for a real HTTP deployment (enables
// proper cross-origin error reporting), but under Electron's file://
// loading it makes Chromium treat the asset request as cross-origin from
// a "null" origin and block it via CORS, leaving a blank window. This
// tiny plugin strips the attribute, applied only for the Electron build.
function stripCrossoriginPlugin() {
  return {
    name: "strip-crossorigin-for-electron",
    transformIndexHtml(html: string) {
      return html
        .replace(/\s+crossorigin(="[^"]*")?/g, "")
        // type="module" scripts are implicitly deferred until after DOM
        // parsing; a classic <script> in <head> is NOT, so we add `defer`
        // explicitly to preserve "run after #root exists" behavior.
        .replace(/<script type="module"/g, "<script defer");
    },
  };
}

export default defineConfig({
  base: isElectronBuild ? "./" : "/",
  plugins: [react(), ...(isElectronBuild ? [stripCrossoriginPlugin()] : [])],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // Chromium's ES module loader refuses to import modules served over
    // file:// regardless of crossorigin/CSP settings — this is a hard
    // browser-level restriction, not something Vite config can route
    // around for a "type=module" script. The fix for Electron's file://
    // loading is to skip ES modules entirely and emit one classic IIFE
    // bundle instead, which loads via a plain non-module <script> tag.
    // The regular web build is unaffected (served over http/https, where
    // ES modules work normally and give better caching/code-splitting).
    ...(isElectronBuild
      ? {
          rollupOptions: {
            output: {
              format: "iife" as const,
              inlineDynamicImports: true,
              entryFileNames: "assets/app.js",
            },
          },
          cssCodeSplit: false,
        }
      : {}),
  },
});
