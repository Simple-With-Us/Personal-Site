#!/usr/bin/env node
/**
 * Static checks for the Infisical sole-source-of-truth rollout.
 * No secrets.  Does not call Infisical.  Safe for GitHub Actions verify.
 *
 * Enforces:
 *  1. INFISICAL.md exists and names every key in SETTINGS_INVENTORY.
 *  2. The settings service exists and points at the right project.
 *  3. No direct `process.env.<MIGRATED_KEY>` READS outside the allowlist —
 *     server code must go through `settingsValue()` (settings.server.ts).
 *  4. The admin surface exists (inventory GET + write-through POST + reload).
 *  5. No invented secret values in the new settings modules.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");

function mustExist(rel) {
  if (!existsSync(join(root, rel))) throw new Error(`missing: ${rel}`);
}
function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

// Keys that belong to Infisical (server-side).  Platform-injected vars
// (VERCEL_ENV, VERCEL_URL, VERCEL_GIT_COMMIT_SHA) are intentionally absent.
const MIGRATED_KEYS = [
  "DATABASE_URL",
  "GROK_AUTH_ISSUER",
  "GROK_AUTH_CLIENT_ID",
  "GROK_AUTH_CLIENT_SECRET",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
  "VITE_AUTH_ENABLED",
  "EMAIL_PASSWORD_ENABLED",
  "DD_API_KEY",
  "DD_SITE",
  "DD_APPLICATION_ID",
  "DD_CLIENT_TOKEN",
  "DD_SERVICE",
  "DD_ENV",
  "DD_VERSION",
  "DD_AGENT_HOST",
  "DD_TRACE_AGENT_PORT",
  "DD_TRACE_SAMPLE_RATE",
  "DD_FAIL_CLOSED",
];
// Note: DD_TRACE_EXPERIMENTAL_EXPORTER is written (not read) by
// applyDatadogProcessEnv for dd-trace import-time compat — it is not a
// managed setting and stays out of SETTINGS_INVENTORY.

// Files allowed to touch process.env for migrated keys, and why:
//  - lib/settings.server.ts ......... the single sanctioned reader (SOT cache + degraded fallback)
//  - lib/datadog/fail-closed.ts ..... dependency-injected readers; default param is process.env
//                                       (its standalone CI unit checks pass env explicitly)
//  - lib/datadog/server.server.ts ... WRITES resolved values back for dd-trace import-time reads
//  - vite.config.ts .................. build-time client-bundle defines (Vercel env <- Infisical sync)
//  - scripts/migrate.mjs ............. build-time DB migration (Vercel env)
const ALLOWLIST = new Set([
  "site/src/lib/settings.server.ts",
  "site/src/lib/datadog/fail-closed.ts",
  "site/src/lib/datadog/server.server.ts",
  "site/vite.config.ts",
  "site/scripts/migrate.mjs",
]);

mustExist("INFISICAL.md");
mustExist("site/src/lib/settings.server.ts");
mustExist("site/src/lib/settings-admin.ts");
mustExist("site/src/routes/admin.settings.tsx");
mustExist("site/tests/unit/settings.test.ts");

const policy = read("INFISICAL.md");
for (const key of MIGRATED_KEYS) {
  if (!policy.includes(key)) {
    throw new Error(`INFISICAL.md does not document key ${key}`);
  }
}

const service = read("site/src/lib/settings.server.ts");
if (!service.includes("44091453-1d4d-4369-b476-751a188c1ee4")) {
  throw new Error("settings.server.ts does not reference the Personal Site Infisical project");
}
if (!service.includes("createInfisicalSettings")) {
  throw new Error("settings.server.ts must use the shared createInfisicalSettings client");
}

// No invented secret values in the new modules (hex blobs, pub/api tokens).
for (const rel of [
  "site/src/lib/settings.server.ts",
  "site/src/lib/settings-admin.ts",
  "site/src/routes/admin.settings.tsx",
]) {
  const text = read(rel);
  if (/[a-f0-9]{32}/.test(text) && !text.includes("44091453-1d4d-4369-b476-751a188c1ee4")) {
    throw new Error(`${rel} looks like it contains a secret value`);
  }
  if (/sk-[a-zA-Z0-9]{8,}/.test(text) || /pub[a-f0-9]{20,}/i.test(text)) {
    throw new Error(`${rel} looks like it contains a secret value`);
  }
}

// Direct process.env reads of migrated keys outside the allowlist.
import { readdirSync, statSync } from "node:fs";
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx|mjs)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}
const files = [
  ...walk(join(site, "src")),
  join(site, "vite.config.ts"),
  ...walk(join(site, "scripts")),
].map((f) => f.slice(root.length + 1));

const violations = [];
for (const rel of files) {
  if (ALLOWLIST.has(rel)) continue;
  const text = read(rel);
  for (const key of MIGRATED_KEYS) {
    // Match reads; skip assignment LHS (`process.env.KEY = ...`).
    const re = new RegExp(`process\\.env\\.${key}(?!\\s*=)`, "g");
    if (re.test(text)) {
      violations.push(`${rel}: direct process.env.${key} read`);
    }
  }
}
if (violations.length > 0) {
  throw new Error(
    "Infisical SOT violation — route through settingsValue():\n" + violations.join("\n"),
  );
}

// Admin surface: inventory GET, write-through POST, reload POST.
const admin = read("site/src/lib/settings-admin.ts");
for (const needle of [
  "getSettingsInventory",
  "updateSetting",
  "reloadSettings",
  "authMiddleware",
  ".set(",
]) {
  if (!admin.includes(needle)) {
    throw new Error(`settings-admin.ts missing ${needle}`);
  }
}
if (!admin.includes("Infisical FIRST")) {
  throw new Error("settings-admin.ts must document write-through ordering");
}

console.log("verify-infisical-sot ok");
