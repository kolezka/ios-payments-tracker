import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: "http://localhost:3011",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
  webServer: {
    command: "bun run preview",
    port: 3011,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: "3011",
      API_URL: "http://localhost:3010",
      BASE_URL: "http://localhost:3011",
      DEV_MODE: "true",
    },
  },
});
