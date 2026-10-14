import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@formwise\/renderer$/, replacement: path.resolve(import.meta.dirname, "packages/renderer/src/index.ts") },
      { find: /^@formwise\/renderer\/core$/, replacement: path.resolve(import.meta.dirname, "packages/renderer/src/core.ts") },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["packages/*/src/**/*.test.{ts,tsx}", "apps/*/src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    // PGlite boots a WASM Postgres per API test file.
    hookTimeout: 30_000,
  },
});
