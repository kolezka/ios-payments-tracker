import { defineConfig } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: isCI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3011",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
  webServer: {
    command: isCI ? "bun ./build/index.js" : "bun run build && bun ./build/index.js",
    port: 3011,
    reuseExistingServer: !isCI,
    env: {
      PORT: "3011",
      API_URL: "http://localhost:3010",
      BASE_URL: "http://localhost:3011",
    },
  },
});
