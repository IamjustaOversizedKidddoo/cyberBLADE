import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/labs/**/*.test.ts", "tests/security/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["vitest.setup.ts"],
    globals: true,
  },
});
