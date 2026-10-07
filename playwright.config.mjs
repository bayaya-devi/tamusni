import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: process.env.TAMUSNI_TEST_URL || 'http://127.0.0.1:8788',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
});
