import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3200);
// One random password per run, shared with workers through the environment. Never committed.
process.env.E2E_PASSWORD ??= randomBytes(12).toString("base64url");
process.env.E2E_EMAIL ??= "e2e@piloto.test";

const serverEnv = {
  PGLITE_DIR: ".data/pglite-e2e",
  DEFAULT_TENANT_SLUG: "piloto",
  SEED_OWNER_EMAIL: process.env.E2E_EMAIL,
  SEED_OWNER_PASSWORD: process.env.E2E_PASSWORD,
  APP_URL: `http://localhost:${PORT}`,
  SEED_E2E_FIXTURES: "1",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", locale: "es-EC", timezoneId: "America/Guayaquil" },
  projects: [
    { name: "warmup", testMatch: /warmup\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, dependencies: ["warmup"] },
    { name: "mobile", use: { ...devices["Pixel 7"] }, dependencies: ["warmup"] },
  ],
  webServer: {
    command: `rm -rf .data/pglite-e2e && npx tsx --conditions=react-server scripts/seed.ts && npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/panel/ingresar`,
    env: serverEnv,
    // Seed + first compile of the login page; slow on a busy machine or a cold CI runner.
    timeout: 360_000,
    reuseExistingServer: false,
  },
});
