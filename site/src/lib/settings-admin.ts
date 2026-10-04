/**
 * Admin settings surface.
 *
 * This is a DUAL module (importable from client components): it only defines
 * `createServerFn` RPC bridges.  The server-only settings service
 * (`./settings.server`) is reached via dynamic import INSIDE the handlers,
 * so the client bundle never evaluates it (same pattern as
 * `lib/auth/middleware.ts`).
 *
 * Admin gating: this is a single-owner personal site.  There is no role
 * system; the signed-in owner IS the admin (documented in INFISICAL.md).
 * Every function below runs behind `authMiddleware`, which rejects
 * signed-out callers with `UnauthorizedError` (401) before any handler runs.
 * The client hides this surface entirely for signed-out visitors
 * (`routes/admin.settings.tsx`).
 *
 * Write-through: `updateSetting` writes to Infisical FIRST via the settings
 * client's `set()`, which only updates the in-memory cache after the
 * Infisical write succeeds.  A failed Infisical write fails the save — the
 * cache and Infisical never diverge silently.
 *
 * The inventory DTO carries key NAMES and presence metadata only — secret
 * values are never sent to the client.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SettingsInventoryItem } from "./settings.server";
import { authMiddleware } from "./auth/middleware";

/**
 * The initialized Infisical client, or throw when settings are in degraded
 * mode (no bootstrap identity).  Write-through and reload are meaningless
 * without Infisical, so they fail loudly instead of pretending to save.
 */
async function requireSettingsClient() {
  const { initSettings, getSettingsClient } = await import("./settings.server");
  await initSettings();
  const client = getSettingsClient();
  if (!client) {
    throw new Error(
      "Settings are in degraded mode (INFISICAL_CLIENT_ID / INFISICAL_CLIENT_SECRET " +
        "are not set on the server) — cannot write through to Infisical.  " +
        "Set the bootstrap identity and retry.  See INFISICAL.md.",
    );
  }
  return client;
}

/** Key inventory for the admin UI: names + presence metadata, never values. */
export const getSettingsInventory = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<SettingsInventoryItem[]> => {
    const { initSettings, buildSettingsInventory } =
      await import("./settings.server");
    await initSettings();
    return buildSettingsInventory();
  });

const updateSettingInput = z.object({
  key: z.string().min(1),
  value: z.string(),
});

/**
 * Write-through setting save.  Validates the key against the inventory,
 * persists to Infisical FIRST, then updates the local cache.  Rejects when
 * the Infisical write fails (cache untouched).
 */
export const updateSetting = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(updateSettingInput)
  .handler(async ({ data }): Promise<{ ok: true; key: string }> => {
    const { assertSettingKey } = await import("./settings.server");
    const meta = assertSettingKey(data.key);
    const client = await requireSettingsClient();
    await client.set(meta.key, data.value);
    return { ok: true, key: meta.key };
  });

/** On-demand cache refresh ("Reload settings" admin action). */
export const reloadSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async (): Promise<{ ok: true }> => {
    const client = await requireSettingsClient();
    await client.refresh();
    return { ok: true };
  });
