import { defineConfig, devices } from '@playwright/test';

/**
 * PLAYWRIGHT_CHROMIUM_PATH lets a machine that already ships Chromium point at
 * it instead of downloading a second copy. Unset — the normal case, including
 * CI — Playwright resolves its own managed browser.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

/**
 * Where the suite points.
 *
 * Locally it drives the dev server, which it starts itself. CI sets
 * PLAYWRIGHT_BASE_URL to a static server holding the exported build — the same
 * files that get published — so the tests exercise what ships rather than a
 * development server that never leaves the runner.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const startsItsOwnServer = !process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL,
    trace: 'on-first-retry',
    launchOptions: { executablePath },
  },
  ...(startsItsOwnServer
    ? {
        webServer: {
          command: 'npm run dev',
          url: baseURL,
          reuseExistingServer: true,
          timeout: 180_000,
        },
      }
    : {}),
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
});
