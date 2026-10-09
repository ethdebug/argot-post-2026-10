import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}",
      "bin/*.test.ts"],
    exclude: ["test/e2e/**", "node_modules/**"],
    // (jsdom renders slowly on a busy machine)
    testTimeout: 15_000,
  },
});
