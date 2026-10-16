import { defineConfig } from "@playwright/test";

export const OWNER_STATE = "tests/.auth/owner.json";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 2,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    // Uses the installed Microsoft Edge so no browser download is needed.
    channel: "msedge",
    // Never pop up browser windows while tests run (PWDEBUG or --headed still override).
    headless: true,
    viewport: { width: 1366, height: 768 },
  },
  projects: [
    // Signs in once as the seeded owner; every other spec starts from that session.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "app",
      dependencies: ["setup"],
      use: { storageState: OWNER_STATE },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/en/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
