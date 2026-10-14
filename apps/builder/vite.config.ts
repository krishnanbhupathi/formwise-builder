import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const renderer = path.resolve(import.meta.dirname, "../../packages/renderer/src");

// The builder compiles the renderer from source, so edits to either show up
// instantly and there's no build step between them.
const api = { "/api": `http://localhost:${process.env.API_PORT ?? 8787}` };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // In development (and the e2e preview) the Hono API runs separately; on Vercel it's same-origin.
  server: { proxy: api },
  preview: { proxy: api },
  resolve: {
    alias: [
      { find: /^@formwise\/renderer$/, replacement: `${renderer}/index.ts` },
      { find: /^@formwise\/renderer\/styles\.css$/, replacement: `${renderer}/styles.css` },
    ],
  },
});
