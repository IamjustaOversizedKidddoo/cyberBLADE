import "@testing-library/jest-dom/vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Every test file gets its own throwaway data directory, so file-backed stores (Handler usage
// metering, progress, operators, AI grading) never read or write the developer's real `.data`.
// Before this, Handler tests accumulated usage in `.data/handler-usage.json` across runs until the
// global daily spend ceiling tripped and later tests silently fell back to the offline provider.
// Always overridden (a shell that exports NEON_DATA_DIR=.data must not leak into tests); one
// directory per worker process, removed when the worker exits.
if (!process.env.NEON_VITEST_DATA_DIR) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "neon-vitest-"));
  process.env.NEON_VITEST_DATA_DIR = dir;
  process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
}
process.env.NEON_DATA_DIR = process.env.NEON_VITEST_DATA_DIR;
