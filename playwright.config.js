import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173/playstats-basketball/',
    headless: true,
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro
    actionTimeout: 8_000,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/playstats-basketball/',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
