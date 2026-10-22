#!/usr/bin/env node
/**
 * Static + unit checks for Personal-Site Datadog SERVER instrumentation.
 * Browser RUM moved to Sentry (see verify-sentry.mjs).  No secrets.
 * Does not call Datadog.  Safe for GitHub Actions verify.
 */
import { execFileSync } from "node:child_process";
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

mustExist("site/src/lib/datadog/fail-closed.ts");
mustExist("site/src/lib/datadog/server.server.ts");
mustExist("static/index.html");
mustExist("AGENTS.md");
mustExist("docs/EFFORT-LOG.md");

mustMatch("static/index.html", /Earlier work included/);
mustMatch("site/src/lib/datadog/fail-closed.ts", /Datadog fail-closed/);
mustMatch("site/src/lib/datadog/fail-closed.ts", /DD_API_KEY/);
mustNotMatch("site/src/lib/datadog/fail-closed.ts", /throw new Error\(datadogFailClosedMessage/);
mustNotMatch("site/src/lib/datadog/server.server.ts", /if \(isDatadogRequired\(\)\) throw/);
mustMatch("site/src/lib/datadog/server.server.ts", /dd-trace/);
mustMatch("site/src/lib/datadog/server.server.ts", /agentless/);

// Browser RUM is gone — Sentry owns the browser now.
mustBeGone("site/src/lib/datadog/rum.ts");
mustBeGone("site/src/lib/datadog/DatadogRum.tsx");
mustBeGone("site/src/lib/datadog/public-env.ts");

// No invented secrets in git.
mustNotMatch("site/src/lib/datadog/fail-closed.ts", /[a-f0-9]{32}/);
mustNotMatch("site/vite.config.ts", /DD_API_KEY.{0,20}["'][a-zA-Z0-9]{8,}/);

const failClosed = join(root, "site/src/lib/datadog/fail-closed.ts");
execFileSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--eval",
    `
    import { assertDatadogKeysOrThrow, isDatadogRequired, missingDatadogKeys } from ${JSON.stringify(failClosed)};

    if (isDatadogRequired({})) throw new Error("local must not require Datadog");
    if (!isDatadogRequired({ VERCEL_ENV: "production" })) throw new Error("production must require Datadog");
    if (!isDatadogRequired({ DD_FAIL_CLOSED: "1" })) throw new Error("DD_FAIL_CLOSED=1 must require Datadog");

    const missing = missingDatadogKeys({});
    if (!missing.includes("DD_API_KEY") || !missing.includes("DD_SITE")) {
      throw new Error("empty env must report missing keys");
    }

    const complete = {
      DD_API_KEY: "placeholder-not-a-real-key",
      DD_SITE: "us5.datadoghq.com",
      DD_APPLICATION_ID: "app-id",
      DD_CLIENT_TOKEN: "client-token",
    };
    if (missingDatadogKeys(complete).length !== 0) {
      throw new Error("complete env should have no missing keys");
    }

    const personalSitePrefixed = {
      PERSONALSITE_DD_API_KEY: "placeholder-not-a-real-key",
      PERSONALSITE_DD_SITE: "us5.datadoghq.com",
      PERSONALSITE_DD_APPLICATION_ID: "app-id",
      PERSONALSITE_DD_CLIENT_TOKEN: "client-token",
    };
    if (missingDatadogKeys(personalSitePrefixed).length !== 0) {
      throw new Error("PERSONALSITE_ prefixed env should have no missing keys");
    }

    // Production without keys must stay dark — never throw.  #19's
    // Vercel Production deploy failed because the old assert aborted
    // vite build when VERCEL_ENV=production and DD_* were unset.
    assertDatadogKeysOrThrow({ VERCEL_ENV: "production" });
    assertDatadogKeysOrThrow({ DD_FAIL_CLOSED: "1" });
    assertDatadogKeysOrThrow({});
    console.log("datadog fail-closed unit checks ok");
    `,
  ],
  { stdio: "inherit" },
);

console.log("verify-datadog ok");
