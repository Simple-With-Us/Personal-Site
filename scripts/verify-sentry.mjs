#!/usr/bin/env node
/**
 * Static checks for Personal-Site Sentry BROWSER instrumentation
 * (errors + tracing + replay + logs into the `personal-site` project).
 * No secrets.  Does not call Sentry.  Safe for GitHub Actions verify.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function mustExist(rel) {
  readFileSync(join(root, rel));
}

function mustMatch(rel, pattern) {
  const text = readFileSync(join(root, rel), "utf8");
  if (!pattern.test(text)) {
    throw new Error(`${rel} does not match ${pattern}`);
  }
}

function mustNotMatch(rel, pattern) {
  const text = readFileSync(join(root, rel), "utf8");
  if (pattern.test(text)) {
    throw new Error(`${rel} unexpectedly matches ${pattern}`);
  }
}

function mustBeGone(rel) {
  if (existsSync(join(root, rel))) {
    throw new Error(`${rel} should have been removed (Datadog RUM moved to Sentry)`);
  }
}

mustExist("site/src/lib/sentry/sentry.ts");
mustExist("site/src/lib/sentry/SentryInit.tsx");
mustExist("site/src/lib/sentry/public-env.ts");

mustMatch("site/src/lib/sentry/sentry.ts", /@sentry\/react/);
mustMatch("site/src/lib/sentry/sentry.ts", /browserTracingIntegration/);
mustMatch("site/src/lib/sentry/sentry.ts", /tanstackRouterBrowserTracingIntegration/);
mustMatch("site/src/lib/sentry/sentry.ts", /replayIntegration/);
mustMatch("site/src/lib/sentry/sentry.ts", /consoleLoggingIntegration/);
mustMatch("site/src/lib/sentry/sentry.ts", /tracesSampleRate/);
mustMatch("site/src/lib/sentry/sentry.ts", /maskAllText: true/);
mustMatch("site/src/lib/sentry/sentry.ts", /captureException/);
mustMatch("site/src/lib/sentry/public-env.ts", /SENTRY_DSN/);
mustMatch("site/src/lib/sentry/public-env.ts", /SENTRY_RELEASE/);
mustMatch("site/src/routes/__root.tsx", /SentryInit/);
mustMatch("site/src/lib/error-component.tsx", /reportVisibleError/);
mustMatch("site/src/lib/error-component.tsx", /lib\/sentry\/sentry/);
mustMatch("site/vite.config.ts", /@sentry\/vite-plugin/);
mustMatch("site/vite.config.ts", /sentryVitePlugin/);
mustMatch("site/vite.config.ts", /SENTRY_AUTH_TOKEN/);
mustMatch("site/vite.config.ts", /SENTRY_DSN/);
mustMatch("site/vite.config.ts", /VERCEL_GIT_COMMIT_SHA/);
mustMatch("site/vite.config.ts", /sourcemap/);
mustMatch("site/package.json", /"@sentry\/react"/);
mustMatch("site/package.json", /"@sentry\/vite-plugin"/);
mustMatch("site/vercel.json", /ingest\.sentry\.io/);

// Datadog browser SDKs are gone; server dd-trace stays.
mustNotMatch("site/package.json", /@datadog\/browser/);
mustNotMatch("site/vercel.json", /datadoghq/);
mustBeGone("site/src/lib/datadog/rum.ts");
mustBeGone("site/src/lib/datadog/DatadogRum.tsx");
mustBeGone("site/src/lib/datadog/public-env.ts");

// No hardcoded DSNs, org tokens, or auth tokens in git — names only.
mustNotMatch("site/src/lib/sentry/sentry.ts", /dsn:\s*["']https?:/);
mustNotMatch("site/src/lib/sentry/public-env.ts", /https:\/\/[^"'\s]*sentry\.io/);
mustNotMatch("site/vite.config.ts", /authToken:\s*["'][A-Za-z0-9]/);
mustNotMatch("site/vite.config.ts", /sntrys_[A-Za-z0-9]/);

console.log("verify-sentry ok");
