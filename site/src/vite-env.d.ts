/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DD_APPLICATION_ID?: string;
  readonly DD_CLIENT_TOKEN?: string;
  readonly DD_SITE?: string;
  readonly DD_SERVICE?: string;
  readonly DD_ENV?: string;
  readonly DD_VERSION?: string;
  readonly DD_FAIL_CLOSED?: string;
  readonly SENTRY_DSN?: string;
  readonly SENTRY_ENVIRONMENT?: string;
  readonly SENTRY_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
