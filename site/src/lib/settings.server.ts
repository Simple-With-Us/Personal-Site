/**
 * Infisical sole-source-of-truth settings — SERVER ONLY.
 *
 * Policy: INFISICAL.md at the repo root.  App-level secrets, env config, and
 * tunable knobs live in the "Personal Site" Infisical project
 * (44091453-1d4d-4369-b476-751a188c1ee4); per-user settings stay in the app's
 * own store (Better Auth / app DB) and are explicitly out of scope.
 *
 * Runtime contract (canonical pattern):
 *   1. Load at startup — `await initSettings()` (runs once, memoized on
 *      globalThis so dev HMR never double-inits) pulls the full secret set
 *      for the matching environment into an in-memory cache.  When the
 *      universal-auth bootstrap identity IS configured but the load fails,
 *      startup fails fast — a configured identity that cannot load is a boot
 *      error, not something to paper over.
 *   2. Never fetch per-request — `settingsValue()` / `settingsRequired()`
 *      read memory (or the degraded process.env fallback) ONLY.  They never
 *      touch the network, so they are safe at module scope and in hot paths.
 *   3. Background refresh — the shared client refreshes every 5 minutes
 *      (tunable via the interval option) and on SIGHUP; refresh failures log
 *      loudly and keep serving the last-known-good cache.
 *   4. Write-through — admin saves go through the client's `set()`, which
 *      writes to Infisical FIRST and only then updates the cache.  A failed
 *      Infisical write fails the save; cache and Infisical never diverge
 *      silently.
 *
 * Degraded mode: when INFISICAL_CLIENT_ID / INFISICAL_CLIENT_SECRET are not
 * set (local dev, live-preview sandbox), the service resolves to `null` and
 * every read falls back to `process.env` — the app keeps its existing
 * zero-config behavior (PGLite, preview auth client).  This is loud (a
 * startup warning) and documented in INFISICAL.md; it is NOT silent.
 *
 * The ONLY process.env reads for migrated keys live in this module (plus the
 * dependency-injected defaults in `datadog/fail-closed.ts`, the build-time
 * `vite.config.ts`, and the build-time `scripts/migrate.mjs` — all called
 * out in INFISICAL.md).  `scripts/verify-infisical-sot.mjs` lints this.
 *
 * No secret VALUES live in this file — key names and metadata only.
 */
import {
  createInfisicalSettings,
  type InfisicalSettings,
} from "@jaywedgeworth22/congress-trading-shared";

/** Infisical project "Personal Site" (jays-services org). */
export const INFISICAL_PROJECT_ID = "44091453-1d4d-4369-b476-751a188c1ee4";

export type SettingKind = "secret" | "env-config" | "knob";

export interface SettingMeta {
  /** Infisical secret key.  Never log or return its VALUE — names only. */
  key: string;
  kind: SettingKind;
  /** True when the app cannot boot correctly without it. */
  required: boolean;
  description: string;
}

/**
 * The full key inventory for this app.  Secret keys are created EMPTY in the
 * Infisical project ("to be filled by admin"); non-sensitive defaults are
 * seeded in the dev environment.  See INFISICAL.md for the table.
 */
export const SETTINGS_INVENTORY: readonly SettingMeta[] = [
  {
    key: "DATABASE_URL",
    kind: "secret",
    required: false,
    description:
      "Neon Postgres connection string.  Empty/absent = embedded PGLite fallback (preview / local dev).",
  },
  {
    key: "GROK_AUTH_ISSUER",
    kind: "env-config",
    required: false,
    description:
      "Auth broker OIDC issuer.  Default https://auth.grok.me.",
  },
  {
    key: "GROK_AUTH_CLIENT_ID",
    kind: "secret",
    required: false,
    description:
      "This app's broker OAuth client id (deployer-injected).  Falls back to the shared live-preview client.",
  },
  {
    key: "GROK_AUTH_CLIENT_SECRET",
    kind: "secret",
    required: false,
    description:
      "This app's broker OAuth client secret (deployer-injected).  Falls back to the shared live-preview client.",
  },
  {
    key: "BETTER_AUTH_URL",
    kind: "env-config",
    required: false,
    description:
      "Explicit public origin for Better Auth.  Absent = dynamic base URL (preview allowlist).",
  },
  {
    key: "BETTER_AUTH_SECRET",
    kind: "secret",
    required: false,
    description:
      "Better Auth signing secret (deployer-injected).  Falls back to a process-stable random secret.",
  },
  {
    key: "VITE_AUTH_ENABLED",
    kind: "env-config",
    required: false,
    description:
      "Feature flag: \"false\" forces auth off everywhere (shared dev user).  Default on.",
  },
  {
    key: "EMAIL_PASSWORD_ENABLED",
    kind: "knob",
    required: false,
    description:
      "Feature flag: \"true\" enables local email/password sign-in.  Default off.",
  },
  {
    key: "DD_API_KEY",
    kind: "secret",
    required: false,
    description: "Datadog API key (agentless server logs + APM).",
  },
  {
    key: "DD_SITE",
    kind: "env-config",
    required: false,
    description: "Datadog site.  Default us5.datadoghq.com.",
  },
  {
    key: "DD_APPLICATION_ID",
    kind: "env-config",
    required: false,
    description:
      "Datadog RUM application id.  Also baked into the client bundle at build time (see INFISICAL.md).",
  },
  {
    key: "DD_CLIENT_TOKEN",
    kind: "secret",
    required: false,
    description:
      "Datadog RUM client token.  Also baked into the client bundle at build time (see INFISICAL.md).",
  },
  {
    key: "DD_SERVICE",
    kind: "env-config",
    required: false,
    description: "Datadog service name.  Default personal-site.",
  },
  {
    key: "DD_ENV",
    kind: "env-config",
    required: false,
    description:
      "Datadog env tag.  Derived from VERCEL_ENV / NODE_ENV when unset.",
  },
  {
    key: "DD_VERSION",
    kind: "env-config",
    required: false,
    description:
      "Datadog version tag.  Derived from VERCEL_GIT_COMMIT_SHA when unset.",
  },
  {
    key: "DD_AGENT_HOST",
    kind: "env-config",
    required: false,
    description:
      "Datadog Agent host (Coolify/Hetzner).  Unset = agentless intake.",
  },
  {
    key: "DD_TRACE_AGENT_PORT",
    kind: "knob",
    required: false,
    description: "Datadog Agent trace port.  Default 8126.",
  },
  {
    key: "DD_TRACE_SAMPLE_RATE",
    kind: "knob",
    required: false,
    description:
      "Trace sample rate.  Fleet cost rule: 0.2 in production.",
  },
  {
    key: "DD_FAIL_CLOSED",
    kind: "knob",
    required: false,
    description:
      "\"1\" = Datadog treated as required even outside production.",
  },
];

/** Map the hosting environment to the Infisical environment slug. */
export function infisicalEnvironment(
  env: Record<string, string | undefined> = process.env,
): string {
  const override = env.INFISICAL_ENV?.trim();
  if (override) return override;
  const vercelEnv = env.VERCEL_ENV?.trim();
  if (vercelEnv === "production") return "prod";
  if (vercelEnv === "preview") return "staging";
  return "dev";
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

const globalRef = globalThis as typeof globalThis & {
  __personalSiteSettingsPromise__?: Promise<InfisicalSettings | null>;
  __personalSiteSettingsWarned__?: boolean;
};

/**
 * Initialize the settings service once per process (HMR-safe).  Resolves to
 * the client, or to `null` in degraded mode (no bootstrap identity).
 * Rejects — fail fast — when the identity IS configured but Infisical cannot
 * be reached.
 */
export function initSettings(): Promise<InfisicalSettings | null> {
  globalRef.__personalSiteSettingsPromise__ ??= (async () => {
    const clientId = readEnv("INFISICAL_CLIENT_ID");
    const clientSecret = readEnv("INFISICAL_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      if (!globalRef.__personalSiteSettingsWarned__) {
        globalRef.__personalSiteSettingsWarned__ = true;
        console.warn(
          "[settings] INFISICAL_CLIENT_ID / INFISICAL_CLIENT_SECRET are not set — " +
            "settings run in DEGRADED mode (process.env fallbacks only).  " +
            "Set the bootstrap identity to load from Infisical.  See INFISICAL.md.",
        );
      }
      return null;
    }
    const settings = createInfisicalSettings({
      projectId: INFISICAL_PROJECT_ID,
      environment: infisicalEnvironment(),
      clientId,
      clientSecret,
    });
    // Fail fast: a configured identity that cannot load is a boot error.
    await settings.init();
    // On-demand refresh for servers (SIGHUP); the client also refreshes on
    // its own background interval.
    process.on("SIGHUP", () => {
      void settings.refresh();
    });
    return settings;
  })();
  return globalRef.__personalSiteSettingsPromise__;
}

/** The initialized client, or `null` in degraded mode / before init. */
export function getSettingsClient(): InfisicalSettings | null {
  // initSettings() is awaited at this module's bottom (top-level await), so
  // by the time any importer reads settings the promise has settled.
  // A rejected promise means fail-fast already fired; surface null here and
  // let the original rejection propagate to whoever awaited initSettings().
  const settled: PromiseSettledResult<InfisicalSettings | null> | undefined = (
    globalRef as Record<string, unknown>
  ).__personalSiteSettingsSettled as
    | PromiseSettledResult<InfisicalSettings | null>
    | undefined;
  return settled?.status === "fulfilled" ? settled.value : null;
}

/**
 * Read a setting: Infisical cache first (SOT wins when configured), then the
 * process.env fallback (degraded mode, platform-injected vars, and keys not
 * present in Infisical).  Trims; empty/whitespace counts as unset.  Never
 * touches the network.
 */
export function settingsValue(key: string): string | undefined {
  const client = getSettingsClient();
  if (client) {
    const fromInfisical = client.has(key) ? client.get(key) : undefined;
    if (fromInfisical !== undefined) {
      const trimmed = fromInfisical.trim();
      return trimmed ? trimmed : undefined;
    }
  }
  return readEnv(key);
}

/**
 * Like `settingsValue`, but throws a clear error naming the missing key and
 * pointing at INFISICAL.md when it is absent.
 */
export function settingsRequired(key: string): string {
  const value = settingsValue(key);
  if (value === undefined) {
    throw new Error(
      `Missing required setting "${key}".  Add it to the "Personal Site" Infisical ` +
        `project (${INFISICAL_PROJECT_ID}) and restart — see INFISICAL.md.`,
    );
  }
  return value;
}

/** Parse a "true"/"false" flag with a default. */
export function settingsFlag(key: string, defaultValue: boolean): boolean {
  const value = settingsValue(key);
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true";
}

/** Look up inventory metadata; throws for unknown keys (admin surface). */
export function assertSettingKey(key: string): SettingMeta {
  const meta = SETTINGS_INVENTORY.find((m) => m.key === key);
  if (!meta) {
    throw new Error(
      `Unknown setting "${key}".  Only keys listed in INFISICAL.md / SETTINGS_INVENTORY can be managed.`,
    );
  }
  return meta;
}

export interface SettingsInventoryItem {
  key: string;
  kind: SettingKind;
  required: boolean;
  description: string;
  /** True when a non-empty value is available (Infisical cache or env fallback). */
  configured: boolean;
  /** Where the value currently comes from.  Never the value itself. */
  source: "infisical" | "process.env" | "degraded: process.env" | "unset";
}

/**
 * Build the admin inventory DTO.  Contains key NAMES and presence metadata
 * ONLY — secret values are never included.  Safe to send to the admin UI.
 */
export function buildSettingsInventory(): SettingsInventoryItem[] {
  const client = getSettingsClient();
  return SETTINGS_INVENTORY.map((meta) => {
    const inInfisical = client?.has(meta.key) === true;
    const value =
      inInfisical && client
        ? client.get(meta.key)
        : readEnv(meta.key);
    const configured =
      value !== undefined && value !== null && value.trim() !== "";
    return {
      key: meta.key,
      kind: meta.kind,
      required: meta.required,
      description: meta.description,
      configured,
      source: inInfisical
        ? "infisical"
        : client
          ? configured
            ? "process.env"
            : "unset"
          : configured
            ? "degraded: process.env"
            : "unset",
    };
  });
}

// Populate the cache before any importer reads settings.  Top-level await is
// supported by Vite SSR, the Nitro ESM server bundle, and Node 24.  In
// degraded mode this resolves immediately (no network); when the bootstrap
// identity IS configured but Infisical is unreachable, the rejection fails
// the boot fast — the module graph cannot finish loading without settings.
const initOutcome = await initSettings().then(
  (value): PromiseSettledResult<InfisicalSettings | null> => ({
    status: "fulfilled",
    value,
  }),
  (reason): PromiseSettledResult<InfisicalSettings | null> => ({
    status: "rejected",
    reason,
  }),
);
(globalRef as Record<string, unknown>).__personalSiteSettingsSettled =
  initOutcome;
if (initOutcome.status === "rejected") {
  throw initOutcome.reason;
}
