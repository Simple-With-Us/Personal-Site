import type { Page } from "@playwright/test";

// Fixed-shape fixture data for /api/quota and /api/rag-snapshot.  The page
// renders relative times ("in 2h 30m", "live · 45s ago") from these, so specs
// must mask those elements (see dashboard-visual.spec.ts) — the fixture only
// needs to be structurally stable, not bit-identical across runs.
//
// The provider values below are the raw slugs Usage Monitor actually emits from
// /api/quota-windows (lowercase, hyphenated) — anthropic, openai, cursor,
// google-antigravity, xai, grok-bot, minimax, deepseek.  Use the real shapes,
// not friendly display names, so the provider-mark mapping is exercised by the
// same strings production sends.  Display names are the page's job, not the API's.
//
// The payload carries BOTH `windows` and `quotaGroups`, as production does.
// `quotaGroups` is the authoritative one: for each provider and window key,
// Usage Monitor publishes the single `primary` reading it picked by source rank
// and freshness band.  `windows` below deliberately DISAGREES with it — see the
// retired Opus row — so the suite fails if the page ever goes back to reducing
// the raw array.  That is the defect OPS-947 fixed: a min() over `windows`
// collapsed Claude's healthy 5-hour budget together with its exhausted 7-day
// budget and reported 0%, while CodeCaps showed 72% and 12%.
export async function mockFleetApis(page: Page) {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();

  const source = (over: Record<string, unknown> = {}) => ({
    source: "codecaps",
    sourceLabel: "CodeCaps",
    machine: "Mac.Jays.Services",
    collector: "codecaps",
    remainingUnknown: false,
    isExhausted: false,
    resetAt: null,
    reportedAt: iso(now - 60_000),
    freshness: "fresh",
    detail: null,
    ...over,
  });

  await page.route("**/api/quota", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generatedAt: iso(now - 45_000),
        windows: [
          {
            provider: "anthropic",
            model: "claude-sonnet-4-5",
            label: "Claude Sonnet 4.5",
            remainingPercent: 72,
            remainingUnknown: false,
            resetAt: iso(now + 2.5 * 3600_000),
          },
          {
            provider: "anthropic",
            model: "claude-opus-4-1",
            label: "Claude Opus 4.1",
            window: "1w",
            remainingPercent: 12,
            remainingUnknown: false,
            resetAt: iso(now + 75 * 60_000),
          },
          {
            // The trap.  An exhausted reading from a machine that stopped
            // reporting two weeks ago, whose reset is already long past.
            // Reducing this array with a min() pins Claude to 0% — which is
            // exactly what start.jays.services reported while CodeCaps, reading
            // quotaGroups, showed the truth.
            provider: "anthropic",
            model: "claude-3-opus-retired",
            label: "Retired Opus",
            remainingPercent: 0,
            remainingUnknown: false,
            isExhausted: true,
            resetAt: iso(now - 14 * 24 * 3600_000),
          },
          {
            provider: "openai",
            model: "gpt-5",
            label: "GPT-5",
            remainingPercent: 100,
            remainingUnknown: false,
            resetAt: iso(now + 5 * 3600_000),
          },
          {
            provider: "cursor",
            model: "auto",
            label: "Included plan",
            remainingPercent: null,
            remainingUnknown: true,
            resetAt: null,
          },
          {
            provider: "google-antigravity",
            model: "gemini-3.1-pro-high",
            label: "Gemini 3.1 Pro High",
            remainingPercent: 25,
            remainingUnknown: false,
            resetAt: iso(now + 59 * 60_000),
          },
          {
            provider: "xai",
            model: "grok-4",
            label: "Grok 4",
            window: "weekly",
            remainingPercent: 20,
            remainingUnknown: false,
            resetAt: iso(now + 7.5 * 3600_000),
          },
          {
            provider: "grok-bot",
            model: "grok-4-fast",
            label: "Grok 4 Fast",
            remainingPercent: 94,
            remainingUnknown: false,
            resetAt: iso(now + 5.2 * 24 * 3600_000),
          },
          {
            provider: "minimax",
            model: "minimax-m2",
            label: "MiniMax M2",
            remainingPercent: 97,
            remainingUnknown: false,
            resetAt: iso(now + 4.25 * 3600_000),
          },
          {
            provider: "deepseek",
            model: "deepseek-v3",
            label: "DeepSeek V3",
            remainingPercent: 60,
            remainingUnknown: false,
            resetAt: iso(now + 20 * 3600_000),
          },
          // An unmapped slug must still render as readable text, not a blank row.
          {
            provider: "some-unknown-gateway",
            model: "mystery-1",
            label: "mystery-1",
            remainingPercent: 55,
            remainingUnknown: false,
            resetAt: iso(now + 9 * 3600_000),
          },
        ],
        quotaGroups: [
          {
            provider: "anthropic",
            providerLabel: "Claude",
            windows: [
              {
                windowKey: "5h",
                displayName: "5-hour",
                rawKey: "five_hour",
                platformTitle: null,
                primary: source({ remainingPercent: 72, resetAt: iso(now + 2.5 * 3600_000) }),
                sources: [source({ remainingPercent: 72, resetAt: iso(now + 2.5 * 3600_000) })],
              },
              {
                windowKey: "7d",
                displayName: "7-day",
                rawKey: "seven_day",
                platformTitle: null,
                primary: source({ remainingPercent: 12, resetAt: iso(now + 75 * 60_000) }),
                sources: [source({ remainingPercent: 12, resetAt: iso(now + 75 * 60_000) })],
              },
            ],
          },
          {
            provider: "openai",
            providerLabel: "Codex",
            windows: [
              {
                windowKey: "1w",
                displayName: "1w",
                rawKey: "1w",
                platformTitle: null,
                primary: source({ remainingPercent: 100, resetAt: iso(now + 5 * 3600_000) }),
                sources: [source({ remainingPercent: 100, resetAt: iso(now + 5 * 3600_000) })],
              },
            ],
          },
          {
            // Upstream spells this one lowercase.  The page's own table is what
            // names it, so "Cursor" must render rather than "cursor".
            provider: "cursor",
            providerLabel: "cursor",
            windows: [
              {
                windowKey: "billing-cycle",
                displayName: "billing-cycle",
                rawKey: "billing-cycle",
                platformTitle: null,
                primary: source({ remainingUnknown: true, remainingPercent: null }),
                sources: [source({ remainingUnknown: true, remainingPercent: null })],
              },
            ],
          },
          {
            provider: "google-antigravity",
            providerLabel: "Antigravity",
            windows: [
              {
                windowKey: "5h",
                displayName: "5-hour",
                rawKey: "5h",
                platformTitle: "Antigravity · Gemini",
                primary: source({ remainingPercent: 25, resetAt: iso(now + 59 * 60_000) }),
                sources: [source({ remainingPercent: 25, resetAt: iso(now + 59 * 60_000) })],
              },
              {
                windowKey: "5h",
                displayName: "5-hour",
                rawKey: "5h",
                platformTitle: "Antigravity · Third-Party",
                primary: source({ remainingPercent: 40, resetAt: iso(now + 62 * 60_000) }),
                sources: [source({ remainingPercent: 40, resetAt: iso(now + 62 * 60_000) })],
              },
            ],
          },
          {
            provider: "xai",
            providerLabel: "Grok",
            windows: [
              {
                windowKey: "1w",
                displayName: "1-week",
                rawKey: "weekly",
                platformTitle: null,
                primary: source({ remainingPercent: 20, resetAt: iso(now + 7.5 * 3600_000) }),
                sources: [source({ remainingPercent: 20, resetAt: iso(now + 7.5 * 3600_000) })],
              },
            ],
          },
          {
            provider: "grok-bot",
            providerLabel: "Grok Bot",
            windows: [
              {
                windowKey: "7d",
                displayName: "7-day",
                rawKey: "weekly",
                platformTitle: null,
                // Aged out of the upstream's fresh band.  The panel must label
                // it rather than present a five-day-old number as live.
                primary: source({
                  remainingPercent: 94,
                  resetAt: iso(now + 5.2 * 24 * 3600_000),
                  reportedAt: iso(now - 5 * 24 * 3600_000),
                  freshness: "old",
                }),
                sources: [
                  source({
                    remainingPercent: 94,
                    resetAt: iso(now + 5.2 * 24 * 3600_000),
                    reportedAt: iso(now - 5 * 24 * 3600_000),
                    freshness: "old",
                  }),
                ],
              },
            ],
          },
          {
            provider: "minimax",
            providerLabel: "MiniMax",
            windows: [
              {
                windowKey: "5h",
                displayName: "5-hour",
                rawKey: "5h",
                platformTitle: null,
                primary: source({ remainingPercent: 97, resetAt: iso(now + 4.25 * 3600_000) }),
                sources: [source({ remainingPercent: 97, resetAt: iso(now + 4.25 * 3600_000) })],
              },
            ],
          },
          {
            provider: "deepseek",
            providerLabel: "DeepSeek",
            windows: [
              {
                windowKey: "5h",
                displayName: "5-hour",
                rawKey: "5h",
                platformTitle: null,
                primary: source({ remainingPercent: 60, resetAt: iso(now + 20 * 3600_000) }),
                sources: [source({ remainingPercent: 60, resetAt: iso(now + 20 * 3600_000) })],
              },
            ],
          },
          {
            provider: "some-unknown-gateway",
            providerLabel: "some-unknown-gateway",
            windows: [
              {
                windowKey: "5h",
                displayName: "5-hour",
                rawKey: "5h",
                platformTitle: null,
                primary: source({ remainingPercent: 55, resetAt: iso(now + 9 * 3600_000) }),
                sources: [source({ remainingPercent: 55, resetAt: iso(now + 9 * 3600_000) })],
              },
            ],
          },
        ],
      }),
    });
  });

  await page.route("**/api/rag-snapshot", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generatedAt: iso(now - 90_000),
        schema: 2,
        corpus: { points: 55627 },
        components: [
          // `icon` set: the card shows the real app icon from public/logos/.
          { acronym: "ST", name: "Socratic.Trade", tagline: "agentic trading console", hits: 1204, icon: "app-st.png" },
          { acronym: "CT", name: "Congress.Trade", repo: "Simple-With-Us/congress-trade", hits: 987, icon: "app-ct.png" },
          { acronym: "BF", name: "BotFleet", tagline: "multi-agent harness", hits: null, icon: "app-bf.png" },
          // No `icon`: a shared library and a private repo keep the monogram
          // tile rather than an empty square.
          { acronym: "CTS", name: "congress-trading-shared", tagline: "shared TS contracts", hits: 521, icon: null },
          // AFC, not AFL (owner ruling 2026-10-11), and it does have an icon.
          { acronym: "AFC", name: "ai-fleet-coordinator", tagline: "fleet coordination", hits: 640, icon: "app-afc.png" },
        ],
        recentChanges: [
          { date: "2026-10-04", seat: "CODEX", title: "2026-10-03 — CODEX — COMPLETED — Bind App tasks to repository" },
          { date: "2026-10-02", seat: "AG", title: "2026-10-02 — AG — COMPLETED/DEPLOYED — Fix web footer" },
          { date: "2026-10-02", seat: "MINIMAX", title: "prepare-cua.mjs has the Oct 1 cloudflared version" },
          // A seat with no logo file: must still render a readable tag.
          { date: "2026-10-01", seat: "FX", title: "Firefox fleet seat tidy-up" },
        ],
        seats: [
          { tag: "CODEX", recentCount: 42, color: "#10A37F", mark: "openai-color.png" },
          { tag: "AG", recentCount: 18, mark: "gemini-color.png" },
          { tag: "FX", recentCount: 7, mark: null },
        ],
      }),
    });
  });
}
