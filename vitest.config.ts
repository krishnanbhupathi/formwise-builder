import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@formwise/renderer": path.resolve(import.meta.dirname, "packages/renderer/src/index.ts") },
  },
  test: {
    environment: "jsdom",
    include: ["packages/*/src/**/*.test.{ts,tsx}", "apps/*/src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
