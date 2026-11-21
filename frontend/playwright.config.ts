import { defineConfig } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 4173)

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // system Chrome with a software GL fallback so tests also run on headless CI machines without a GPU
    channel: process.env.E2E_CHANNEL ?? 'chrome',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
    viewport: { width: 1440, height: 900 },
  },
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: `npx vite preview --port ${PORT} --strictPort`,
        port: PORT,
        reuseExistingServer: true,
        timeout: 60_000,
      },
})
