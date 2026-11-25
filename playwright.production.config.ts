import { defineConfig } from '@playwright/test'
const url = 'http://127.0.0.1:47137'
export default defineConfig({
  testDir: './tests/production',
  outputDir: 'test-results/production',
  workers: 1,
  use: { channel: 'chrome', baseURL: url },
  webServer: {
    command: 'npm run preview -w @freton/web -- --port 47137 --strictPort',
    url,
    reuseExistingServer: false,
  },
})
