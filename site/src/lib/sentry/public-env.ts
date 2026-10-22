/**
 * Public Sentry fields only.  Vite `define` injects the existing SENTRY_*
 * names at build time.  Never put SENTRY_AUTH_TOKEN or any DSN secret here
 * beyond the public browser DSN (same pattern as the old DD client token:
 * baked into the client bundle, sourced from Infisical → Vercel env sync).
 */
export type SentryPublicEnv = {
  dsn: string;
  environment: string;
  release: string;
};

function readDefined(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readSentryPublicEnv(): SentryPublicEnv {
  return {
    dsn: readDefined(import.meta.env.SENTRY_DSN),
    environment: readDefined(import.meta.env.SENTRY_ENVIRONMENT) || "development",
    release: readDefined(import.meta.env.SENTRY_RELEASE) || "unknown",
  };
}
