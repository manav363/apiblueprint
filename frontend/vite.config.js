import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    css: true,
    // Playwright owns e2e/ — keep Vitest out of it (it would match *.spec.js).
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
