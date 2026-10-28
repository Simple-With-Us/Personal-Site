import { defineConfig } from "@playwright/test";

// The start site's visual and behaviour specs.  The start site is a separate
// application from the main site in this repository:  it is the static
// `start/public` tree served by its own Vercel project, with no build step.
// The specs therefore run against a plain static server rather than the Vite
// dev server the main site's config uses.
//
// The /api/* endpoints the page calls are route-mocked in the specs, so they
// never reach this server and the screenshots never depend on live data.
const baseURL = process.env.START_SITE_BASE_URL ?? "http://127.0.0.1:3102";

export default defineConfig({
  testDir: "./tests/start-e2e",
  timeout: 60_000,
  // Run serially: the specs share one static server and one mocked API.
  workers: 1,
  reporter: "list",
  snapshotPathTemplate:
    "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  use: { baseURL },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "node tests/start-e2e/serve-start.mjs 3102",
    url: baseURL,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
});
