import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import {
  getSettingsInventory,
  reloadSettings,
  updateSetting,
} from "@/lib/settings-admin";
import type { SettingsInventoryItem } from "@/lib/settings.server";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsPage,
});

/**
 * Admin settings console (owner only).  Signed-out visitors see a sign-in
 * card (no redirect — this repo has no /login route); every server function
 * behind this page additionally requires a signed-in session (the signed-in
 * owner IS the admin on this single-owner site — see INFISICAL.md).  The
 * inventory shows key NAMES and presence metadata only — secret values are
 * never rendered.
 */
function AdminSettingsPage() {
  return (
    <>
      <SignedOut>
        <main className="mx-auto max-w-2xl px-6 py-16">
          <h1 className="text-2xl font-semibold text-fg">Admin Settings</h1>
          <p className="mt-2 text-sm text-fg-subtle">
            This console is for the site owner. Sign in to manage app
            settings.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() =>
                  void signIn(p.providerId, {
                    callbackURL: "/admin/settings",
                  })
                }
                className="rounded-md bg-fg px-4 py-2 text-sm font-medium text-bg"
              >
                Sign in with {p.label}
              </button>
            ))}
          </div>
        </main>
      </SignedOut>
      <SignedIn>
        <SettingsPanel />
      </SignedIn>
    </>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: SettingsInventoryItem[] };

function SettingsPanel() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // setState lives in the promise callbacks, not the effect body.  Initial
  // state is already "loading".  save/reload set "loading" in the click
  // handler, then reuse this fetch.
  const fetchInventory = useCallback(() => {
    return getSettingsInventory().then(
      (items) => {
        setState({ status: "ready", items });
      },
      (err: unknown) => {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      },
    );
  }, []);

  useEffect(() => {
    void fetchInventory();
  }, [fetchInventory]);

  const load = useCallback(() => {
    setState({ status: "loading" });
    return fetchInventory();
  }, [fetchInventory]);

  const save = async (key: string) => {
    setSaving(true);
    setNotice(null);
    try {
      // Write-through: Infisical FIRST, then the local cache.  A failed
      // write rejects and the save fails — nothing diverges silently.
      await updateSetting({ data: { key, value: draftValue } });
      setNotice(`Saved "${key}" to Infisical.`);
      setEditingKey(null);
      setDraftValue("");
      await load();
    } catch (err) {
      setNotice(
        `Save failed for "${key}": ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const reload = async () => {
    setNotice(null);
    try {
      await reloadSettings();
      setNotice("Settings reloaded from Infisical.");
      await load();
    } catch (err) {
      setNotice(
        `Reload failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-medium tracking-tight text-fg">
        Admin · Settings
      </h1>
      <p className="mt-2 text-sm text-fg-subtle">
        Infisical is the sole source of truth for app settings.  Values are
        never displayed here — type a new value to rotate or set a key.  See{" "}
        <span className="font-mono">INFISICAL.md</span> for the key inventory
        and rotation notes.
      </p>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-md border border-border bg-bg px-3 py-2 text-sm font-medium text-fg hover:bg-bg-muted"
        >
          Reload settings from Infisical
        </button>
      </div>

      {notice && (
        <p className="mt-4 rounded-md border border-border bg-bg-muted px-3 py-2 text-sm text-fg">
          {notice}
        </p>
      )}

      {state.status === "loading" && (
        <p className="mt-8 text-sm text-fg-subtle">Loading settings…</p>
      )}
      {state.status === "error" && (
        <p className="mt-8 text-sm text-red-600">
          Could not load settings: {state.message}
        </p>
      )}
      {state.status === "ready" && (
        <table className="mt-8 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-fg-subtle">
              <th className="py-2 pr-4 font-medium">Key</th>
              <th className="py-2 pr-4 font-medium">Kind</th>
              <th className="py-2 pr-4 font-medium">Configured</th>
              <th className="py-2 pr-4 font-medium">Source</th>
              <th className="py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((item) => (
              <tr key={item.key} className="border-b border-border/60">
                <td className="py-2 pr-4 align-top">
                  <span className="font-mono text-[13px] text-fg">
                    {item.key}
                  </span>
                  <p className="mt-1 max-w-md text-xs text-fg-subtle">
                    {item.description}
                  </p>
                </td>
                <td className="py-2 pr-4 align-top text-fg-muted">
                  {item.kind}
                </td>
                <td className="py-2 pr-4 align-top text-fg-muted">
                  {item.configured ? "yes" : "no"}
                </td>
                <td className="py-2 pr-4 align-top text-fg-muted">
                  {item.source}
                </td>
                <td className="py-2 align-top">
                  {editingKey === item.key ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="password"
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        placeholder="New value (never displayed)"
                        autoComplete="off"
                        className="w-56 rounded-md border border-border bg-bg px-2 py-1 font-mono text-[13px] text-fg"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void save(item.key)}
                          className="rounded-md bg-fg px-3 py-1 text-sm font-medium text-bg disabled:opacity-50"
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setEditingKey(null);
                            setDraftValue("");
                          }}
                          className="rounded-md border border-border px-3 py-1 text-sm text-fg-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingKey(item.key);
                        setDraftValue("");
                        setNotice(null);
                      }}
                      className="rounded-md border border-border px-3 py-1 text-sm text-fg hover:bg-bg-muted"
                    >
                      {item.configured ? "Rotate" : "Set"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
