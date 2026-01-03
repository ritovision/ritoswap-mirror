// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // Global timeout – increased for slower CI builds
  timeout: 60_000,
  // Per-expect timeout
  expect: {
    timeout: 30_000,
  },
  // Reporter configuration
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'on-failure' }]],
  // Shared settings for all projects
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    locale: 'en-US',
    timezoneId: 'America/New_York',
  },
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],
  // Only spin up local server if BASE_URL is not provided
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'pnpm run start',
        port: 3000,
        timeout: 240 * 1000, // 4 minutes
        reuseExistingServer: true,
      },
  // Where to store screenshots, videos, traces, etc.
  outputDir: 'test-results/',
});