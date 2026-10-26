import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static build. Heavy deps (MapLibre, Plot) are code-split per route through
// React.lazy in src/main.tsx.
//
// sourcemap stays false to keep the shipped payload small; the original source
// is published in the public repository instead. The banner below survives
// minification and carries the license notice into the compiled bundle.
const BANNER =
  "/*! Brasil em Orbita: Indice de Dependencia Municipal (IDM)\n" +
  " * Copyright 2026 Pedro Carvalho Brom, Daniel Soares de Souza.\n" +
  " * Codigo sob licenca MIT; dados derivados e documentacao sob CC BY 4.0.\n" +
  " * Fonte: https://github.com/pcbrom/indice-dependencia-municipal\n" +
  " * Os dados abertos federais reusados pertencem aos respectivos orgaos e\n" +
  " * seguem os termos deles.\n" +
  " */";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    sourcemap: false,
    rollupOptions: {
      output: {
        banner: BANNER,
      },
    },
  },
  server: {
    port: 5173,
  },
});
