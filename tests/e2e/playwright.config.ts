import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for AnatoView.
 *
 * Assumes the full Docker stack is running via:
 *   docker compose -f docker-compose.yml -f docker-compose.test.yml up -d
 *
 * Run from the repo root:
 *   npx playwright test --config=tests/e2e/playwright.config.ts
 */
export default defineConfig({
  testDir: '.',
  globalSetup: './helpers/global-setup.ts',
  fullyParallel: false,              // Run sequentially — tests share DB state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,                        // Single worker to avoid DB race conditions
  reporter: [
    ['html', { outputFolder: '../../playwright-report' }],
    ['list'],
  ],
  timeout: 60_000,                   // 60s per test — lab wizard has many steps

  use: {
    baseURL: 'http://localhost',     // nginx reverse proxy
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
  },

  outputDir: '../../test-results',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Do not start dev server — expect Docker stack to be running already */
});
