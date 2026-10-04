/**
 * Server logs + APM.  Uses existing DD_* env vars.  On Vercel there is no
 * local Agent, so traces go agentless (DD_API_KEY + DD_SITE).  If
 * DD_AGENT_HOST is set (Coolify / Hetzner), traces go to that Agent instead.
 */
import { createRequire } from "node:module";
import {
  assertDatadogKeysOrThrow,
  datadogEnvName,
  datadogService,
  datadogSite,
  datadogVersion,
  readApiKey,
  type DatadogEnv,
} from "./fail-closed";
// Infisical SOT: this module's import awaits settings init (top-level await
// in settings.server.ts), so the cache is populated before initDatadogServer
// runs at the bottom of this file.  See INFISICAL.md.
import { getSettingsClient } from "../settings.server";

type LogStatus = "info" | "warn" | "error";

const originalError = console.error.bind(console);
const originalWarn = console.warn.bind(console);

/**
 * The effective Datadog env: Infisical cache wins for managed keys (it is
 * the SOT), process.env covers platform-injected vars (VERCEL_ENV, …) and
 * degraded mode.  Memory-only — never touches the network — so it is safe
 * in hot paths like sendServerLog.
 */
function currentDatadogEnv(): DatadogEnv {
  const client = getSettingsClient();
  if (!client) return process.env;
  const merged: DatadogEnv = { ...process.env };
  for (const [key, value] of Object.entries(client.getAll())) {
    if (value.trim() !== "") merged[key] = value;
  }
  return merged;
}

const globalRef = globalThis as typeof globalThis & {
  __personalSiteDatadogServer__?: boolean;
  __personalSiteDatadogConsole__?: boolean;
};

export function initDatadogServer(): void {
  const ddEnv = currentDatadogEnv();
  assertDatadogKeysOrThrow(ddEnv);

  if (globalRef.__personalSiteDatadogServer__) return;
  globalRef.__personalSiteDatadogServer__ = true;

  const apiKey = readApiKey(ddEnv);
  if (!apiKey) {
    return;
  }

  applyDatadogProcessEnv(ddEnv);

  const useAgent = Boolean(ddEnv.DD_AGENT_HOST?.trim());

  try {
    // dd-trace reads DD_* at import time, so env aliases must be set first.
    const require = createRequire(import.meta.url);
    const tracer = require("dd-trace") as {
      init: (opts?: Record<string, unknown>) => unknown;
    };
    tracer.init({
      // Resolved values were published onto process.env by
      // applyDatadogProcessEnv above; pass ddEnv explicitly for clarity.
      service: datadogService(ddEnv),
      env: datadogEnvName(ddEnv),
      version: datadogVersion(ddEnv),
      logInjection: true,
      runtimeMetrics: false,
      plugins: true,
      hostname: useAgent ? ddEnv.DD_AGENT_HOST : undefined,
      port: useAgent ? ddEnv.DD_TRACE_AGENT_PORT || "8126" : undefined,
    });
  } catch (err) {
    // Native tracer is optional on Vercel.  HTTP logs still work.
    // Never rethrow — that 500s every SSR request in production.
    originalError("dd-trace init failed:", err);
    return;
  }

  hookConsoleAndProcess();
}

/**
 * Resolve Datadog values from the effective env (Infisical SOT) and publish
 * them back onto process.env, because dd-trace reads DD_* at import time.
 * Writes only — the reads above come from the merged env.
 */
function applyDatadogProcessEnv(ddEnv: DatadogEnv): void {
  const useAgent = Boolean(ddEnv.DD_AGENT_HOST?.trim());
  if (!useAgent && !process.env.DD_TRACE_EXPERIMENTAL_EXPORTER) {
    process.env.DD_TRACE_EXPERIMENTAL_EXPORTER = "agentless";
  }
  if (!process.env.DD_SERVICE) process.env.DD_SERVICE = datadogService(ddEnv);
  if (!process.env.DD_ENV) process.env.DD_ENV = datadogEnvName(ddEnv);
  if (!process.env.DD_VERSION) process.env.DD_VERSION = datadogVersion(ddEnv);
  if (!process.env.DD_SITE) process.env.DD_SITE = datadogSite(ddEnv);

  // Sample 20% of prod traces (fleet cost rule).  Errors stay visible.
  // VERCEL_ENV is platform-injected, never an Infisical key.
  if (!process.env.DD_TRACE_SAMPLE_RATE && process.env.VERCEL_ENV === "production") {
    process.env.DD_TRACE_SAMPLE_RATE = ddEnv.DD_TRACE_SAMPLE_RATE || "0.2";
  }
}

function hookConsoleAndProcess(): void {
  if (globalRef.__personalSiteDatadogConsole__) return;
  globalRef.__personalSiteDatadogConsole__ = true;

  console.error = (...args: unknown[]) => {
    originalError(...args);
    void sendServerLog("error", stringifyArgs(args));
  };
  console.warn = (...args: unknown[]) => {
    originalWarn(...args);
    // Error-only HTTP intake on Free.  Warn stays local.
  };

  process.on("uncaughtException", (error) => {
    originalError("uncaughtException", error);
    void sendServerLog("error", error.message, {
      error: { kind: error.name, message: error.message, stack: error.stack },
    });
  });
  process.on("unhandledRejection", (reason) => {
    originalError("unhandledRejection", reason);
    const message = reason instanceof Error ? reason.message : String(reason);
    void sendServerLog("error", message, { unhandledRejection: true });
  });
}

function stringifyArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg instanceof Error) return arg.stack || arg.message;
      if (typeof arg === "string") return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
}

export async function sendServerLog(
  status: LogStatus,
  message: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  // Memory-only env merge (Infisical cache + process.env) — no network.
  const ddEnv = currentDatadogEnv();
  const apiKey = readApiKey(ddEnv);
  if (!apiKey) {
    return;
  }

  const site = datadogSite(ddEnv);
  const url = `https://http-intake.logs.${site}/api/v2/logs`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DD-API-KEY": apiKey,
      },
      body: JSON.stringify([
        {
          ddsource: "nodejs",
          ddtags: `env:${datadogEnvName(ddEnv)},service:${datadogService(ddEnv)},version:${datadogVersion(ddEnv)}`,
          hostname: process.env.VERCEL_URL || datadogService(ddEnv),
          service: datadogService(ddEnv),
          status,
          message,
          ...extra,
        },
      ]),
    });
    if (!response.ok) {
      originalWarn(`Datadog logs intake failed: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    originalWarn("Datadog logs intake request failed:", err);
  }
}

initDatadogServer();
