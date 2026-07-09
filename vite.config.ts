/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// Relative asset paths so the built site works under any base path
// (e.g. apps.charliekrug.com/api-breakcheck).
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
  },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**"],
      // Type-only declarations and the stylesheet carry no testable logic.
      exclude: ["src/**/types.ts", "src/style.css"],
    },
  },
});
