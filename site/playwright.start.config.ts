import { defineConfig, devices } from "@playwright/test";

// The start site's visual and behaviour specs.  The start site is a separate
// application from the main site in this repository:  it is the static
// `start/public` tree served by its own Vercel project, with no build step.
// The specs therefore run against a plain static server rather than the Vite
// dev server the main site's config uses.
//
// The /api/* endpoints the page calls are route-mocked in the specs, so they
// never reach this server and the screenshots never depend on live data.
//
// The projects, viewport, timezone and screenshot tolerance are the ones the
// committed baselines were generated with, in the repository the site came
// from.  Changing any of them invalidates every baseline.
const baseURL = process.env.START_SITE_BASE_URL ?? "http://127.0.0.1:3102";

export default defineConfig({
  testDir: "./tests/start-e2e",
  snapshotPathTemplate:
    "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL,
    timezoneId: "America/Chicago",
    trace: "retain-on-failure",
  },
  expect: {
    toHaveScreenshot: {
      // Tolerate cross-machine font rasterization differences; committed
      // baselines are generated on Linux and compared on Linux CI.
      maxDiffPixelRatio: 0.02,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chromium"], viewport: { width: 1280, height: 900 } },
    },
    {
      name: "chromium-dark",
      use: {
        ...devices["Desktop Chromium"],
        viewport: { width: 1280, height: 900 },
        colorScheme: "dark",
      },
    },
  ],
  webServer: {
    command: "node tests/start-e2e/serve-start.mjs 3102",
    url: baseURL,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
});
