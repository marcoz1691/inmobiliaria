import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": new URL("./test/server-only-stub.ts", import.meta.url).pathname },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    testTimeout: 30_000,
    // Each file migrates its own PGlite; on a loaded machine that alone can exceed a minute.
    hookTimeout: 180_000,
    coverage: {
      provider: "v8",
      include: ["src/modules/**/*.ts", "src/server/**/*.ts"],
      exclude: ["**/*.test.ts", "src/server/db/schema.ts"],
      reporter: ["text-summary", "text", "html", "json-summary"],
      reportsDirectory: "coverage",
    },
  },
});
