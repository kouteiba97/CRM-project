import { defineConfig } from "@playwright/test";

/**
 * Builds the user guide, not a test suite: `npm run guide` takes screenshots in English and
 * Arabic, renders docs/Apex-CRM-Guide-{EN,AR}.pdf and records the video tours.
 * Needs the dev server (npm run dev) and a freshly seeded database (npm run db:seed).
 */
export default defineConfig({
  testDir: ".",
  testMatch: /(capture|build|tour)\.spec\.ts/,
  timeout: 240_000,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    channel: "msedge",
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: "capture", testMatch: /capture\.spec\.ts/ },
    { name: "build", testMatch: /build\.spec\.ts/, dependencies: ["capture"] },
    { name: "tour", testMatch: /tour\.spec\.ts/ },
  ],
});
