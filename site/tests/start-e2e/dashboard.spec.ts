import { test, expect } from "@playwright/test";
import { mockFleetApis } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mockFleetApis(page);
  await page.goto("/");
});

test("dashboard renders header, search, and panels", async ({ page }) => {
  await expect(page).toHaveTitle(/Fleet operations · jays\.services/);
  await expect(page.locator("#greeting")).toContainText(", Jay.");
  await expect(page.locator("#search #q")).toHaveAttribute(
    "placeholder",
    "Search or type a URL",
  );
  await expect(page.locator("#quotas-card h2")).toHaveText("Agent Quotas");
  await expect(page.locator("#rag-card h2")).toHaveText("Fleet RAG");
});

test("quota panel renders one row per quota window, grouped under its provider", async ({ page }) => {
  const body = page.locator("#quotas-body");
  // Each provider is a .quota-provider-block: a .quota-provider header followed
  // by its .quota-row.sub window rows.  The old shape was one .quota-row per
  // provider, which cannot show a provider's 5-hour and 7-day budgets apart.
  await expect(body.locator(".quota-provider-block")).toHaveCount(10);
  await expect(body.locator(".quota-provider")).toHaveCount(10);
  // 9 providers, but Antigravity publishes two platform cards and Claude has
  // two windows — so 11 rows in total, not 9.
  await expect(body.locator(".quota-row.sub")).toHaveCount(11);
  await expect(body.locator("h3", { hasText: "Hottest Models" })).toHaveCount(0);
  await expect(body.locator(".quota-provider", { hasText: "Claude" })).toBeVisible();
  await expect(body).toContainText("12%");
  await expect(body).toContainText("100%");
  await expect(body).toContainText("n/a");
  // Every block carries a header and at least one window row.
  await expect(body.locator(".quota-provider-block:has(.quota-provider)")).toHaveCount(10);
  await expect(body.locator(".quota-provider-block:has(.quota-row.sub)")).toHaveCount(10);
});

test("quota panel reads quotaGroups, not the raw windows array", async ({ page }) => {
  const body = page.locator("#quotas-body");
  // The fixture's `windows` array still holds a two-week-old exhausted Claude
  // reading whose reset is in the past.  Reducing that array — the defect
  // OPS-947 fixed — pins Claude to 0% and drags the countdown behind it.
  // quotaGroups says Claude is 72% / 12%, and that is what must render.
  //
  // Assert on the value element with an exact text match.  A `not.toContainText
  // ("0%")` on the panel would be a substring check and would match "100%",
  // which is one of the healthy readings this test is protecting.
  const values = body.locator(".quota-val b");
  await expect(values.filter({ hasText: /^0%$/ })).toHaveCount(0);
  await expect(body).not.toContainText("in resetting");

  const claude = body.locator(".quota-provider-block").filter({
    has: page.locator(".quota-provider", { hasText: "Claude" }),
  });
  const claudeRows = claude.locator(".quota-row.sub");
  await expect(claudeRows).toHaveCount(2);
  // Locate by content, not by position: the panel sorts most-constrained window
  // first, so the 12% 7-day row legitimately comes before the 72% 5-hour row.
  const fiveHour = claudeRows.filter({ hasText: "5-hour" });
  const sevenDay = claudeRows.filter({ hasText: "7-day" });
  await expect(fiveHour.locator(".quota-val b")).toHaveText("72%");
  await expect(sevenDay.locator(".quota-val b")).toHaveText("12%");
  // Most-constrained first within the provider too.
  await expect(claudeRows.first()).toContainText("12%");
  // And the panel must not have fallen back to the degraded branch: that branch
  // collapses windows and says so.
  await expect(body.locator(".quota-degraded")).toHaveCount(0);
});

test("a reading aged out of the fresh band is labelled, not shown as live", async ({ page }) => {
  const body = page.locator("#quotas-body");
  // The Grok Bot window in the fixture is reported five days ago.
  const grokBot = body.locator(".quota-provider-block").filter({
    has: page.locator(".quota-provider", { hasText: "Grok Bot" }),
  });
  await expect(grokBot.locator(".quota-status.old")).toHaveText("outdated");
  // A fresh provider carries no such chip, or the chip proves nothing.
  const codex = body.locator(".quota-provider-block").filter({
    has: page.locator(".quota-provider", { hasText: "Codex" }),
  });
  await expect(codex.locator(".quota-status.old")).toHaveCount(0);
});

test("Antigravity's two platform cards render as separate rows", async ({ page }) => {
  const body = page.locator("#quotas-body");
  // One provider slug, two platformTitle values.  They have to be told apart or
  // the reader cannot tell the Gemini budget from the Third-Party one.
  const block = (title: string) =>
    body.locator(".quota-provider-block").filter({
      has: page.locator(".quota-provider .quota-id .n", { hasText: new RegExp(`^${title}$`) }),
    });
  await expect(block("Antigravity · Gemini")).toHaveCount(1);
  await expect(block("Antigravity · Third-Party")).toHaveCount(1);
  await expect(block("Antigravity · Gemini").locator(".quota-val b")).toHaveText("25%");
  await expect(block("Antigravity · Third-Party").locator(".quota-val b")).toHaveText("40%");
});

test("quota panel shows platform names, not raw provider slugs", async ({ page }) => {
  const body = page.locator("#quotas-body");
  // Product names, matching CodeCaps — not company names and not raw slugs.
  // Match the .n span by exact text: hasText is a substring match, and "Grok"
  // is a prefix of "Grok Bot", so a substring locator resolves to two rows and
  // trips Playwright strict mode instead of asserting anything.
  const label = (text: string) => body.locator(".quota-id .n").filter({ hasText: new RegExp(`^${text}$`) });
  await expect(label("Claude")).toBeVisible();
  await expect(label("Grok")).toBeVisible();
  await expect(label("MiniMax")).toBeVisible();
  await expect(label("DeepSeek")).toBeVisible();
  // grok-bot shares the Grok mark but keeps its own display name.
  await expect(label("Grok Bot")).toBeVisible();
  // Antigravity names itself by platform, because it publishes two cards.
  await expect(label("Antigravity · Gemini")).toBeVisible();
  await expect(label("Antigravity · Third-Party")).toBeVisible();
  // The providerLabel upstream sends is lowercase for this one; the page's own
  // table is what names it, so the mark must sit beside "Cursor".
  await expect(label("Cursor")).toBeVisible();
  await expect(label("cursor")).toHaveCount(0);
  // No raw slug may leak into the heading.
  await expect(body.locator(".quota-id .n", { hasText: "google-antigravity" })).toHaveCount(0);
  // An unmapped slug still renders as text rather than a blank row.
  await expect(label("some-unknown-gateway")).toBeVisible();
});

test("quota rows name the product, never the company", async ({ page }) => {
  const body = page.locator("#quotas-body");
  // The page and CodeCaps must agree on what the reader calls each platform:
  // providerKey "anthropic" is "Claude", "openai" is "Codex", "xai" is "Grok",
  // "google-antigravity" is "Antigravity".  Shipping the Grok mark under an
  // "xAI" label is the exact mistake this guards.
  for (const company of ["Anthropic", "OpenAI", "xAI", "Google"]) {
    await expect(body.locator(".quota-id .n", { hasText: company })).toHaveCount(0);
  }
  // "Claude" must still be present, so the assertion above is not just
  // passing because the panel failed to render at all.
  await expect(body.locator(".quota-id .n", { hasText: "Claude" })).toHaveCount(1);
});

test("quota rows render the mark CodeCaps serves for that provider", async ({ page }) => {
  // The mark lives in the provider header, not in a window row.
  const row = (label: string) =>
    page.locator("#quotas-body .quota-provider").filter({
      has: page.locator(".quota-id .n", { hasText: new RegExp(`^${label}$`) }),
    });

  // Owner ruling 2026-10-11: one set of marks, owned by CodeCaps.  Pinning the
  // filename per provider is what makes "the mark CodeCaps uses" checkable —
  // a generic "an image rendered" assertion would pass on any wrong artwork.
  const expected: Record<string, string> = {
    Claude: "/logos/claude-color.png",
    Codex: "/logos/openai-color.png",
    Grok: "/logos/grok-color.png",
    "Grok Bot": "/logos/grok-bot-color.png",
    "Antigravity · Gemini": "/logos/gemini-color.png",
    MiniMax: "/logos/minimax.png",
    Cursor: "/logos/cursor-color.png",
  };
  for (const [label, src] of Object.entries(expected)) {
    await expect(row(label).locator(".pmark"), label).toHaveAttribute("src", src);
  }

  // Every mark must resolve.  A 404 is exactly the failure an empty mark hides.
  const srcs = await page
    .locator("#quotas-body .pmark")
    .evaluateAll((els) => els.map((e) => e.getAttribute("src") || ""));
  expect(srcs.length).toBeGreaterThan(0);
  for (const src of srcs) {
    const res = await page.request.get(src);
    expect(res.status(), `${src} must exist in public/logos/`).toBe(200);
  }
});

test("the Grok logo and the Grok Web/iOS app icon are not confused", async ({ page }) => {
  const markSrc = (label: string) =>
    page
      .locator("#quotas-body .quota-provider")
      .filter({ has: page.locator(".quota-id .n", { hasText: new RegExp(`^${label}$`) }) })
      .locator(".pmark")
      .getAttribute("src");

  // The black rounded-square tile is the Grok Web/iOS app icon and belongs on
  // an app surface.  Drawing it as the Grok logo is what this guards; Grok Bot
  // is a separate seat with a separate mark, so the two must not be the same.
  const grok = await markSrc("Grok");
  const grokBot = await markSrc("Grok Bot");
  expect(grok).toBe("/logos/grok-color.png");
  expect(grokBot).toBe("/logos/grok-bot-color.png");
  expect(grok).not.toBe(grokBot);
});

test("a provider with no shipped mark still names itself in text", async ({ page }) => {
  const body = page.locator("#quotas-body");
  const rowFor = (label: string) =>
    // The inner locator must be page-rooted, not scoped to #quotas-body: a
    // `has:` filter is re-queried inside each candidate row, so a selector that
    // starts at #quotas-body matches nothing there and the row is never found.
    page.locator("#quotas-body .quota-provider").filter({
      has: page.locator(".quota-id .n", { hasText: new RegExp(`^${label}$`) }),
    });

  // DeepSeek: CodeCaps ships no artwork, so the one inlined whale stays and
  // paints in the text colour, on both themes.
  await expect(rowFor("DeepSeek").locator(".pmark svg")).toHaveAttribute("fill", "currentColor");

  // An unmapped slug gets no mark at all — borrowing a neighbouring brand's
  // mark would be worse than a readable name.
  const unknown = rowFor("some-unknown-gateway");
  await expect(unknown.locator(".pmark")).toHaveCount(0);
  await expect(unknown.locator(".quota-id .n")).toHaveText("some-unknown-gateway");
});

test("panel meta lines report age, never the countdown's 'resetting'", async ({ page }) => {
  // generatedAt is a PAST instant.  relTime() counts down to a future one and
  // returns "resetting" for anything past, which rendered "live · resetting ago".
  const quotaMeta = page.locator("#quota-meta");
  const ragMeta = page.locator("#rag-meta");
  await expect(quotaMeta).toContainText("live ·");
  await expect(ragMeta).toContainText("live ·");
  await expect(quotaMeta).not.toContainText("resetting");
  await expect(ragMeta).not.toContainText("resetting");
  // Age of a 45s / 90s old reading.  Patterns, not literals: the clock ticks
  // while the page boots, and 90s sits on the 1m/2m boundary.  What matters is
  // the shape (a relative age) and the absence of "resetting".
  await expect(quotaMeta).toHaveText(/^live · \d+s$/);
  await expect(ragMeta).toHaveText(/^live · [12]m · 55,627 pts$/);
});

test("RAG panel renders mocked components, changes, and seats", async ({ page }) => {
  await expect(page.locator("#rag-components .comp-card")).toHaveCount(5);
  await expect(page.locator("#rag-components")).toContainText("Socratic.Trade");
  // AFC, not AFL: the component acronym names the repo, and the coordinator's
  // seat tag is a different namespace.  A row with an icon shows no acronym
  // text, so this asserts the row itself rather than the tile.
  await expect(page.locator("#rag-components")).toContainText("ai-fleet-coordinator");
  await expect(page.locator("#rag-components")).not.toContainText("AFL");
  await expect(page.locator("#rag-changes li")).toHaveCount(4);
  await expect(page.locator("#rag-changes")).toContainText("2026-10-04");
  await expect(page.locator("#rag-seats .seat-bar")).toHaveCount(3);
});

test("components show the real app icon beside the app name", async ({ page }) => {
  const comps = page.locator("#rag-components .comp-card");
  // An app that ships an icon renders the icon file, not a monogram tile.
  // Socratic.Trade is the one that shipped a bare brand mark instead of the
  // app icon, so its file name is the regression worth pinning.
  const st = comps.filter({ hasText: "Socratic.Trade" });
  await expect(st.locator(".comp-acr .app-icon")).toHaveAttribute("src", "/logos/app-st.png");
  await expect(st.locator(".comp-acr")).not.toHaveClass(/mono/);
  // ai-fleet-coordinator gets its real icon too.
  const afc = comps.filter({ hasText: "ai-fleet-coordinator" });
  await expect(afc.locator(".comp-acr .app-icon")).toHaveAttribute("src", "/logos/app-afc.png");
  // The name still ships next to the icon — the icon supplements, never
  // replaces, the label.
  await expect(st.locator(".comp-meta .n")).toHaveText("Socratic.Trade");
  // Every referenced icon must actually resolve; a 404 here is the exact
  // failure the monogram fallback hides.
  const srcs = await page.locator("#rag-components .app-icon").evaluateAll((els) =>
    els.map((e) => (e as HTMLImageElement).getAttribute("src") || ""),
  );
  expect(srcs.length).toBe(4);
  for (const src of srcs) {
    const res = await page.request.get(src);
    expect(res.status(), `${src} must exist in public/logos/`).toBe(200);
  }
  // A component with no icon keeps the monogram tile — never an empty square.
  const cts = comps.filter({ hasText: "congress-trading-shared" });
  await expect(cts.locator(".comp-acr")).toHaveClass(/mono/);
  await expect(cts.locator(".comp-acr")).toHaveText("CTS");
  await expect(cts.locator(".app-icon")).toHaveCount(0);
});

test("seat chips and bars lead with the seat logo, not a bare name", async ({ page }) => {
  // Top Seats bar: mark then tag text.
  const codexBar = page.locator("#rag-seats .seat-bar").filter({ hasText: "CODEX" });
  await expect(codexBar.locator(".lbl .seat-mark")).toHaveAttribute("src", "/logos/openai-color.png");
  await expect(codexBar.locator(".lbl")).toContainText("CODEX");

  // Recent Changes chip: mark inside the coloured seat pill.
  const codexRow = page.locator("#rag-changes li").filter({ hasText: "CODEX" });
  await expect(codexRow.locator(".seat .seat-mark")).toHaveAttribute("src", "/logos/openai-color.png");
  // MINIMAX is not in the Top-Seats roster but still gets a mark, so a credited
  // change is never a bare coloured pill.
  const mmRow = page.locator("#rag-changes li").filter({ hasText: "prepare-cua" });
  await expect(mmRow.locator(".seat .seat-mark")).toHaveAttribute("src", "/logos/minimax.png");
  // Antigravity wears the Gemini logo (owner ruling 2026-10-11): the AG chip and
  // a Gemini chip resolve to the same asset, and there is no separate ag.svg.
  const agRow = page.locator("#rag-changes li").filter({ hasText: "web footer" });
  await expect(agRow.locator(".seat .seat-mark")).toHaveAttribute("src", "/logos/gemini-color.png");

  // A seat with no logo file still renders its tag, just without a mark.
  const fxBar = page.locator("#rag-seats .seat-bar").filter({ hasText: "FX" });
  await expect(fxBar.locator(".seat-mark")).toHaveCount(0);
  await expect(fxBar.locator(".lbl")).toHaveText("FX");
});

test("search grid renders the three sections", async ({ page }) => {
  const grid = page.locator("#grid");
  await expect(grid.locator("h2", { hasText: "Fleet" })).toBeVisible();
  await expect(grid.locator("h2", { hasText: "Apps" })).toBeVisible();
  await expect(grid.locator("h2", { hasText: "Infra & Tools" })).toBeVisible();
  await expect(grid.getByRole("link", { name: /THE BOARD/ })).toBeVisible();
});

test("settings sheet opens and closes", async ({ page }) => {
  const sheet = page.locator("#settings");
  await expect(sheet).toBeHidden();
  await page.locator("#open-settings").click();
  await expect(sheet).toBeVisible();
  await expect(sheet.locator("#settings-title")).toHaveText("Settings");
  await page.locator("#close-settings").click();
  await expect(sheet).toBeHidden();
});
