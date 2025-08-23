// vitest.config.js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.js"],
    hookTimeout: 30000,
    testTimeout: 30000,
    restoreMocks: true,
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
