import { defineConfig, devices } from "@playwright/test";

/** Set to a deployed URL to run the suite against it (no local servers). */
const REMOTE = process.env.E2E_BASE_URL;
const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://localhost/formwise_e2e";

// Runs against the production build (vite preview) and the real API + Postgres.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: REMOTE ?? "http://localhost:4180", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: REMOTE ? undefined : [
    {
      // API on a test database, freshly migrated and emptied.
      command: "npm run db:migrate -w @formwise/api && psql \"$DATABASE_URL\" -qc 'TRUNCATE forms, rate_limits CASCADE' && npm start -w @formwise/api",
      url: "http://localhost:8788/api/health",
      env: { DATABASE_URL: E2E_DATABASE_URL, API_PORT: "8788" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npm run build && npm run preview -w @formwise/builder -- --port 4180 --strictPort",
      url: "http://localhost:4180",
      env: { API_PORT: "8788" },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
