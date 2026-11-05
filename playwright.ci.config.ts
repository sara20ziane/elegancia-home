import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/isolated",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
    baseURL: "http://127.0.0.1:8080",
    locale: "ar-DZ",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-360",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command: "node --experimental-strip-types scripts/testing/storefront-server.mjs",
      url: "http://127.0.0.1:54329/health",
      reuseExistingServer: false,
    },
    {
      command:
        process.env.E2E_BUILT === "true"
          ? "npm run preview -- --host 127.0.0.1 --port 8080"
          : "npm run dev",
      url: "http://127.0.0.1:8080",
      reuseExistingServer: false,
      timeout: 180000,
      env: {
        VITE_SUPABASE_URL: "http://127.0.0.1:54329",
        VITE_SUPABASE_PUBLISHABLE_KEY: "synthetic-local-publishable-key",
        VITE_SUPABASE_PROJECT_ID: "isolated-local",
        SUPABASE_SERVICE_ROLE_KEY: "",
        PACKERS_API_TOKEN: "",
        GUEPEX_API_TOKEN: "",
        TELEGRAM_BOT_TOKEN: "",
        VITE_WEB_ANALYTICS_ENABLED: "false",
      },
    },
  ],
});
