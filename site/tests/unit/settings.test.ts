/**
 * Unit tests for the Infisical SOT settings contract.
 *
 * Run: `npm run test:unit` (node --test with type stripping — no new
 * devDependencies).  No network: every Infisical HTTP call is served by the
 * mock fetch below.  No secret values anywhere — only key names.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createInfisicalSettings,
  InfisicalWriteError,
} from "@jaywedgeworth22/congress-trading-shared";

// ---------------------------------------------------------------------------
// Mock Infisical HTTP surface
// ---------------------------------------------------------------------------

interface RecordedCall {
  url: string;
  method: string;
  body: string | undefined;
}

function createMockFetch() {
  const calls: RecordedCall[] = [];
  let secrets: Record<string, string> = { FOO: "bar", NUM: "42" };
  const failNext: { get?: number; patch?: number } = {};

  const fetchImpl = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const u = String(url);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? init.body : undefined;
    calls.push({ url: u, method, body });

    if (u.includes("/api/v1/auth/universal-auth/login")) {
      return new Response(
        JSON.stringify({ accessToken: "test-token", expiresIn: 3600 }),
        { status: 200 },
      );
    }
    if (u.includes("/api/v3/secrets/raw")) {
      if (method === "GET") {
        if (failNext.get) {
          const status = failNext.get;
          delete failNext.get;
          return new Response("boom", { status });
        }
        return new Response(
          JSON.stringify({
            secrets: Object.entries(secrets).map(([secretKey, secretValue]) => ({
              secretKey,
              secretValue,
            })),
          }),
          { status: 200 },
        );
      }
      const key = decodeURIComponent(u.split("/").pop() ?? "");
      if (method === "PATCH") {
        if (failNext.patch) {
          const status = failNext.patch;
          delete failNext.patch;
          return new Response("boom", { status });
        }
        if (!(key in secrets)) return new Response("not found", { status: 404 });
        const parsed = JSON.parse(body ?? "{}") as { secretValue?: string };
        secrets[key] = parsed.secretValue ?? "";
        return new Response(JSON.stringify({}), { status: 200 });
      }
      if (method === "POST") {
        const parsed = JSON.parse(body ?? "{}") as { secretValue?: string };
        secrets[key] = parsed.secretValue ?? "";
        return new Response(JSON.stringify({}), { status: 200 });
      }
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  return {
    fetchImpl,
    calls,
    getSecrets: () => ({ ...secrets }),
    setSecrets: (next: Record<string, string>) => {
      secrets = { ...next };
    },
    failNext,
  };
}

function makeClient(mock: ReturnType<typeof createMockFetch>) {
  return createInfisicalSettings({
    projectId: "00000000-0000-0000-0000-000000000000",
    environment: "dev",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    fetchImpl: mock.fetchImpl,
    refreshIntervalMs: 0, // no background timer in tests
  });
}

// ---------------------------------------------------------------------------
// Shared-client contract (createInfisicalSettings)
// ---------------------------------------------------------------------------

describe("infisical settings client contract", () => {
  it("startup load populates the cache", async () => {
    const mock = createMockFetch();
    const client = makeClient(mock);
    await client.init();
    try {
      assert.equal(client.get("FOO"), "bar");
      assert.equal(client.get("NUM"), "42");
      assert.equal(client.has("MISSING"), false);
      assert.deepEqual(client.getAll(), { FOO: "bar", NUM: "42" });
    } finally {
      client.stop();
    }
  });

  it("runtime reads make zero network calls after init", async () => {
    const mock = createMockFetch();
    const client = makeClient(mock);
    await client.init();
    try {
      const callsAfterInit = mock.calls.length;
      assert.ok(callsAfterInit > 0, "init should have hit the network");
      client.get("FOO");
      client.get("MISSING");
      client.has("FOO");
      client.getAll();
      client.getRequired("FOO");
      assert.equal(
        mock.calls.length,
        callsAfterInit,
        "reads after init must not touch the network",
      );
    } finally {
      client.stop();
    }
  });

  it("write-through persists to Infisical before updating the cache", async () => {
    const mock = createMockFetch();
    const client = makeClient(mock);
    await client.init();
    try {
      const callsBefore = mock.calls.length;
      await client.set("FOO", "rotated");
      const writeCalls = mock.calls.slice(callsBefore);
      assert.equal(writeCalls[0]?.method, "PATCH");
      assert.ok(
        writeCalls[0]?.url.endsWith("/FOO"),
        "PATCH targets the key endpoint",
      );
      assert.ok(
        (writeCalls[0]?.body ?? "").includes("rotated"),
        "PATCH carries the new value",
      );
      // Cache reflects the write only after Infisical accepted it.
      assert.equal(client.get("FOO"), "rotated");
      assert.equal(mock.getSecrets().FOO, "rotated");
    } finally {
      client.stop();
    }
  });

  it("write-through creates missing keys via POST after PATCH 404", async () => {
    const mock = createMockFetch();
    const client = makeClient(mock);
    await client.init();
    try {
      const callsBefore = mock.calls.length;
      await client.set("BRAND_NEW", "hello");
      const methods = mock.calls.slice(callsBefore).map((c) => c.method);
      assert.deepEqual(methods, ["PATCH", "POST"]);
      assert.equal(client.get("BRAND_NEW"), "hello");
    } finally {
      client.stop();
    }
  });

  it("failed refresh keeps the last-known-good cache", async () => {
    const mock = createMockFetch();
    const client = makeClient(mock);
    await client.init();
    try {
      assert.equal(client.get("FOO"), "bar");
      mock.failNext.get = 500;
      await assert.rejects(client.refresh(), /HTTP 500/);
      assert.equal(
        client.get("FOO"),
        "bar",
        "stale cache must survive a failed refresh",
      );
    } finally {
      client.stop();
    }
  });

  it("failed write-through rejects and leaves the cache untouched", async () => {
    const mock = createMockFetch();
    const client = makeClient(mock);
    await client.init();
    try {
      mock.failNext.patch = 500;
      await assert.rejects(
        client.set("FOO", "nope"),
        (err: unknown) =>
          err instanceof InfisicalWriteError && err.key === "FOO",
        "must reject with InfisicalWriteError naming the key",
      );
      assert.equal(
        client.get("FOO"),
        "bar",
        "cache must not diverge on a failed write",
      );
      assert.equal(mock.getSecrets().FOO, "bar");
    } finally {
      client.stop();
    }
  });

  it("getRequired throws a clear error naming the missing key", async () => {
    const mock = createMockFetch();
    const client = makeClient(mock);
    await client.init();
    try {
      assert.throws(() => client.getRequired("NOPE"), /"NOPE"/);
    } finally {
      client.stop();
    }
  });

  it("constructor requires universal-auth credentials", () => {
    delete process.env.INFISICAL_CLIENT_ID;
    delete process.env.INFISICAL_CLIENT_SECRET;
    assert.throws(
      () =>
        createInfisicalSettings({
          projectId: "x",
          environment: "dev",
          fetchImpl: createMockFetch().fetchImpl,
          refreshIntervalMs: 0,
        }),
      /universal-auth credentials are required/,
    );
  });
});

// ---------------------------------------------------------------------------
// App settings service (settings.server.ts) — degraded mode, no network
// ---------------------------------------------------------------------------

// Scrub the bootstrap identity BEFORE the module's top-level await runs, so
// the import below settles in degraded mode without touching the network.
delete process.env.INFISICAL_CLIENT_ID;
delete process.env.INFISICAL_CLIENT_SECRET;
const settingsModule = await import("../../src/lib/settings.server.ts");

describe("personal-site settings service", () => {

  it("inventory is well-formed: unique keys, valid kinds, descriptions", () => {
    const { SETTINGS_INVENTORY } = settingsModule;
    assert.ok(SETTINGS_INVENTORY.length > 0);
    const keys = SETTINGS_INVENTORY.map((m) => m.key);
    assert.equal(new Set(keys).size, keys.length, "keys must be unique");
    for (const meta of SETTINGS_INVENTORY) {
      assert.ok(meta.key.length > 0);
      assert.ok(
        ["secret", "env-config", "knob"].includes(meta.kind),
        `bad kind for ${meta.key}`,
      );
      assert.ok(meta.description.length > 0, `no description for ${meta.key}`);
      assert.equal(typeof meta.required, "boolean");
    }
    for (const expected of [
      "DATABASE_URL",
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
      "DD_TRACE_SAMPLE_RATE",
    ]) {
      assert.ok(keys.includes(expected), `inventory missing ${expected}`);
    }
  });

  it("infisicalEnvironment maps the hosting env to slugs", () => {
    const { infisicalEnvironment } = settingsModule;
    assert.equal(
      infisicalEnvironment({ VERCEL_ENV: "production" }),
      "prod",
    );
    assert.equal(infisicalEnvironment({ VERCEL_ENV: "preview" }), "staging");
    assert.equal(infisicalEnvironment({}), "dev");
    assert.equal(
      infisicalEnvironment({ VERCEL_ENV: "production", INFISICAL_ENV: "dev" }),
      "dev",
      "explicit INFISICAL_ENV wins",
    );
  });

  it("degraded mode: initSettings resolves null with zero network calls", async () => {
    const { initSettings } = settingsModule;
    const client = await initSettings();
    assert.equal(client, null, "no bootstrap identity -> degraded null");
  });

  it("settingsValue trims, treats empty as unset, falls back to process.env", async () => {
    const { settingsValue } = settingsModule;
    process.env.SOT_TEST_KEY = "  spaced  ";
    assert.equal(settingsValue("SOT_TEST_KEY"), "spaced");
    process.env.SOT_TEST_KEY = "   ";
    assert.equal(settingsValue("SOT_TEST_KEY"), undefined);
    delete process.env.SOT_TEST_KEY;
    assert.equal(settingsValue("SOT_TEST_KEY"), undefined);
  });

  it("settingsRequired throws naming the key and INFISICAL.md", async () => {
    const { settingsRequired } = settingsModule;
    assert.throws(
      () => settingsRequired("SOT_DEFINITELY_MISSING"),
      /"SOT_DEFINITELY_MISSING".*INFISICAL\.md/,
    );
  });

  it("settingsFlag parses true/false with a default", async () => {
    const { settingsFlag } = settingsModule;
    process.env.SOT_FLAG = "true";
    assert.equal(settingsFlag("SOT_FLAG", false), true);
    process.env.SOT_FLAG = "false";
    assert.equal(settingsFlag("SOT_FLAG", true), false);
    delete process.env.SOT_FLAG;
    assert.equal(settingsFlag("SOT_FLAG", true), true);
    assert.equal(settingsFlag("SOT_FLAG", false), false);
  });

  it("assertSettingKey accepts inventory keys and rejects unknown keys", async () => {
    const { assertSettingKey } = settingsModule;
    assert.equal(assertSettingKey("DD_API_KEY").key, "DD_API_KEY");
    assert.throws(() => assertSettingKey("EVIL_KEY"), /Unknown setting/);
  });

  it("buildSettingsInventory exposes names/metadata only — never values", async () => {
    const { buildSettingsInventory } = settingsModule;
    process.env.SOT_INVENTORY_PROBE = "super-secret-value";
    // Not in the inventory, so it must not appear at all.
    const items = buildSettingsInventory();
    const serialized = JSON.stringify(items);
    assert.ok(
      !serialized.includes("super-secret-value"),
      "no secret value may leak into the DTO",
    );
    assert.ok(
      !serialized.includes("SOT_INVENTORY_PROBE"),
      "non-inventory keys must not appear",
    );
    for (const item of items) {
      assert.ok(!("value" in item), `item ${item.key} must not carry a value`);
      assert.ok(
        ["infisical", "process.env", "degraded: process.env", "unset"].includes(
          item.source,
        ),
      );
    }
    delete process.env.SOT_INVENTORY_PROBE;
  });
});
