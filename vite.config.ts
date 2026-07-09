import { defineConfig } from "vite";

// Relative asset paths so the built site works under any base path
// (e.g. apps.charliekrug.com/api-breakcheck).
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
  },
});
