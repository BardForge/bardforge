import { defineConfig } from '@playwright/test';
const port = Number(process.env.BARDFORGE_TEST_PORT ?? 5173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid test port');
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  workers: 2,
  use: {
    baseURL,
    viewport: { width: 1440, height: 960 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run dev:web -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
