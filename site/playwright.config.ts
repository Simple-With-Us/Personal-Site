import { defineConfig } from '@playwright/test';

// Fleet rollout scaffold: chromium-only smoke tests against a local server.
// Point PLAYWRIGHT_BASE_URL at a deployed environment to run against it.
//
// NOTE: the webServer runs the *dev* server, not `vite preview`. This app's
// production build uses the Vercel nitro preset (output in .vercel/output),
// which TanStack Start's `vite preview` cannot serve — it looks for the
// node-server preset bundle at dist/server/server.js and crashes with
// ERR_MODULE_NOT_FOUND, so Playwright times out waiting for the server.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  // The e2e job runs against the Vite dev server, whose first request can
  // intermittently fail while the compiler warms up (observed ~25% flake on
  // the smoke test before any visual specs existed).  Retry once on CI so a
  // cold dev server does not red the job; visual assertions stay strict.
  retries: process.env.CI ? 1 : 0,
  // Run serially: concurrent tests hammering a cold dev server worsen the
  // warm-up flake, and serial order lets the smoke test warm the server for
  // the visual specs.
  workers: 1,
  reporter: 'list',
  use: { baseURL },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run dev -- --port 4173 --host 127.0.0.1',
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
