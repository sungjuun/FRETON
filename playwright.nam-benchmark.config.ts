import { defineConfig } from '@playwright/test'
import production from './playwright.production.config'

export default defineConfig(production, {
  testDir: './tests/benchmark',
  testMatch: '**/*.bench.ts',
  outputDir: '.local/nam-benchmark',
  timeout: 120_000,
  retries: 0,
})
