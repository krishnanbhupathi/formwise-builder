import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const renderer = path.resolve(import.meta.dirname, "../../packages/renderer/src");

// The builder compiles the renderer from source, so edits to either show up
// instantly and there's no build step between them.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@formwise\/renderer$/, replacement: `${renderer}/index.ts` },
      { find: /^@formwise\/renderer\/styles\.css$/, replacement: `${renderer}/styles.css` },
    ],
  },
});
