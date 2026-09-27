import path from "node:path";
import { defineConfig } from "vitest/config";

// Un solo runner para todo el monorepo: los tests viven junto al código (`*.test.ts`).
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/*/src/**/*.test.{ts,tsx}",
      "apps/web/src/**/*.test.{ts,tsx}",
      "scripts/**/*.test.ts",
    ],
    setupFiles: ["./vitest.setup.ts"],
    // Los tests de integración comparten una base: se corren en serie.
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "apps/web/src") },
  },
});
