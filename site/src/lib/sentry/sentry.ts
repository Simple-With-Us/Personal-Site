import * as Sentry from "@sentry/react";
import { readSentryPublicEnv } from "./public-env";

let sentryStarted = false;

/**
 * Browser observability for the portfolio.  Replaces Datadog RUM:
 * errors + tracing + Session Replay + browser logs, all to the
 * `personal-site` Sentry project.  Release comes from the Vercel commit
 * SHA so events line up with source-map uploads.
 *
 * Missing DSN stays dark (same fail-open browser posture the old RUM
 * init had): never throw from a root useEffect.
 */
export function initSentry(router?: unknown): void {
  if (typeof window === "undefined" || sentryStarted) return;

  const cfg = readSentryPublicEnv();
  if (!cfg.dsn) {
    return;
  }

  sentryStarted = true;

  const isProd = cfg.environment === "production";

  Sentry.init({
    dsn: cfg.dsn,
    environment: cfg.environment,
    release: cfg.release,
    // Fleet cost rule mirrors Datadog: sample 20% of prod traces.
    tracesSampleRate: isProd ? 0.2 : 1.0,
    replaysSessionSampleRate: isProd ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      router
        ? Sentry.tanstackRouterBrowserTracingIntegration(router)
        : Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
      Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
    ],
  });
}

export function reportVisibleError(error: unknown): void {
  if (typeof window === "undefined") return;
  try {
    initSentry();
    Sentry.captureException(error);
  } catch (reportError) {
    console.error("Sentry error report failed:", reportError);
    console.error(error);
  }
}
