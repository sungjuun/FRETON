import { defineConfig } from '@playwright/test'
const url = 'http://127.0.0.1:47136'
export default defineConfig({
  testDir: './tests',
  testIgnore: '**/production/**',
  workers: 1,
  use: {
    channel: 'chrome',
    baseURL: url,
    viewport: { width: 1440, height: 960 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -w @freton/web -- --port 47136',
    url,
    reuseExistingServer: false,
  },
})
