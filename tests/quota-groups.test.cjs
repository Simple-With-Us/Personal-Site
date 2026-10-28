const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// The Agent Quotas panel on start.jays.services used to re-derive one number
// per provider with Math.min() over the raw `windows[]` array.  That array
// holds a reading per (provider, windowKey, machine) for the last 14 days, so
// collapsing it with a min conflated unrelated quota windows and let one
// long-dead reading from a machine that stopped reporting pin the provider to
// 0%.  On 2026-10-13 that made the panel claim Claude, Codex and Antigravity
// were exhausted while CodeCaps — which renders the upstream's merged
// `quotaGroups` — showed 100%, 41% and 96%.
//
// The fix renders `quotaGroups[].windows[].primary`, the single reading that
// Usage Monitor's src/lib/quota-groups.ts picks by source rank and freshness.
// These tests run the REAL functions lifted out of start/public/index.html rather
// than a copy, so a refactor cannot leave the shipped page untested.

const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'start/public/index.html'), 'utf8');

// Lift `function NAME(...) { ... }` out of the page by brace matching.  A
// regex would stop at the first `}` inside a nested block.
function extractFunction(name) {
  const start = page.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, `${name} is missing from start/public/index.html`);
  const braceAt = page.indexOf('{', start);
  let depth = 0;
  for (let i = braceAt; i < page.length; i += 1) {
    if (page[i] === '{') depth += 1;
    else if (page[i] === '}') {
      depth -= 1;
      if (depth === 0) return page.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces extracting ${name}`);
}

const quotaRows = new Function(
  [
    extractFunction('quotaRowsFromGroups'),
    extractFunction('quotaRowsFromWindows'),
    extractFunction('sortQuotaRows'),
    extractFunction('quotaRows'),
    'return quotaRows;',
  ].join('\n\n'),
)();

const payload = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'quota-windows.json'), 'utf8'));

// Index the rows the panel would draw, keyed by "<providerLabel>|<windowKey>".
function byLabelWindow(rows) {
  const map = new Map();
  for (const row of rows) map.set(`${row.label}|${row.windowKey}`, row);
  return map;
}

// The pre-fix aggregation, reproduced here purely to prove the fixture still
// contains the trap.  If this ever reports the CORRECT numbers, the fixture
// has stopped exercising the bug and the assertions below are vacuous.
function oldAggregation(windows) {
  const by = new Map();
  for (const w of windows) {
    const p = w.provider || w.sourceApp || 'unknown';
    if (!by.has(p)) by.set(p, []);
    by.get(p).push(w);
  }
  const out = new Map();
  for (const [p, models] of by) {
    const knowns = models.filter((m) => !m.remainingUnknown && typeof m.remainingPercent === 'number');
    out.set(p, knowns.length ? Math.min(...knowns.map((m) => m.remainingPercent)) : null);
  }
  return out;
}

test('the fixture still contains the rows that broke the panel', () => {
  // Control: run the OLD logic first.  It must misreport, otherwise the test
  // below is not actually guarding anything.
  const old = oldAggregation(payload.windows);
  assert.equal(old.get('anthropic'), 0, 'expected the old min-over-raw-windows to report Claude at 0%');
  assert.equal(old.get('openai'), 0, 'expected the old aggregation to report Codex at 0%');

  // Claude's healthy 5-hour window and its exhausted 7-day window coexist in
  // the same provider.  Collapsing them is the defect.
  const claudeFiveHour = payload.windows.find(
    (w) => w.provider === 'anthropic' && Number(w.remainingPercent) === 100,
  );
  const claudeSevenDay = payload.windows.find(
    (w) => w.provider === 'anthropic' && w.isExhausted === true,
  );
  assert.ok(claudeFiveHour, 'fixture needs a healthy Claude 5-hour reading');
  assert.ok(claudeSevenDay, 'fixture needs an exhausted Claude 7-day reading');
});

test('every row shows the merged primary reading CodeCaps shows', () => {
  const rows = byLabelWindow(quotaRows(payload));

  // These are the values CodeCaps displayed when the report was filed.
  const expected = [
    ['Codex|1w', 41],
    ['MiniMax|5h', 87],
    ['Antigravity · Gemini|5h', 96],
    ['Antigravity · Third-Party|5h', 100],
    ['Muse Code|7d', 94],
    ['Muse|7d', 39],
    ['Grok Bot|7d', 91],
    ['Grok|1w', 60],
  ];
  for (const [key, pct] of expected) {
    const row = rows.get(key);
    assert.ok(row, `no row for ${key}; got ${[...rows.keys()].join(', ')}`);
    assert.equal(
      Math.round(row.remainingPercent),
      pct,
      `${key} should read ${pct}%, not ${row.remainingPercent}`,
    );
  }
});

test("Claude's exhausted 7-day window no longer hides its healthy 5-hour window", () => {
  const rows = byLabelWindow(quotaRows(payload));

  const five = rows.get('Claude|5h');
  const seven = rows.get('Claude|7d');
  assert.ok(five && seven, 'both Claude windows must be present');

  assert.equal(Math.round(five.remainingPercent), 100, 'Claude 5-hour should read 100%');
  assert.equal(seven.remainingPercent, 0, 'Claude 7-day should read 0%');
  assert.equal(seven.isExhausted, true, 'the exhausted window must still be marked exhausted');

  // The regression itself: one provider, two windows, two honest numbers.
  assert.notEqual(five.remainingPercent, seven.remainingPercent);
});

test('an aged-out reading is labelled rather than presented as live', () => {
  const rows = byLabelWindow(quotaRows(payload));
  // Claude's rows come from api.anthropic.com readings that have aged past the
  // upstream's 30-minute fresh band.  The renderer keys its "outdated" chip off
  // this field, so it has to survive the projection.
  const stale = [...rows.values()].filter((r) => r.freshness === 'old' || r.freshness === 'stale');
  assert.ok(stale.length > 0, 'fixture should contain at least one aged-out reading');
  assert.ok(
    [...rows.values()].some((r) => r.freshness === 'fresh'),
    'fixture should contain at least one fresh reading, or nothing is proven about stale marking',
  );
});

test('rows sort most-constrained first, and unknown numbers last', () => {
  const rows = quotaRows(payload);
  const known = rows.filter((r) => r.remainingPercent != null).map((r) => r.remainingPercent);
  const sortedKnown = [...known].sort((a, b) => a - b);
  assert.deepEqual(known, sortedKnown, 'known percentages must be ascending');

  const firstUnknown = rows.findIndex((r) => r.remainingPercent == null);
  if (firstUnknown !== -1) {
    assert.ok(
      rows.slice(firstUnknown).every((r) => r.remainingPercent == null),
      'an unknown percentage must not sort ahead of a known one',
    );
  }
});

test('only a real platformTitle overrides the local provider label', () => {
  const rows = quotaRows(payload);

  // Antigravity genuinely publishes two cards under one provider slug, so its
  // platformTitle has to win or the two cards render identically.
  const titles = rows.filter((r) => r.overrideLabel).map((r) => r.overrideLabel);
  assert.deepEqual(
    [...new Set(titles)].sort(),
    ['Antigravity · Gemini', 'Antigravity · Third-Party'],
    'exactly the Antigravity cards may carry a platformTitle override',
  );

  // Everything else keeps the local PROVIDERS label: upstream spells this
  // provider "cursor" in lowercase, and the local table knows it as "Cursor".
  assert.equal(
    rows.filter((r) => r.provider === 'cursor').every((r) => r.overrideLabel === null),
    true,
    "upstream providerLabel must not overwrite the local label",
  );
});

test('the provider divider is keyed off the wrapper, not the header', () => {
  // Each .quota-provider is the first child of its own .quota-provider-block, so
  // a `:first-child` rule on the header matches EVERY provider and strips every
  // divider in the panel.  It renders fine, so only the baseline catches it —
  // and the baseline is exactly what this class of bug slips past.
  assert.equal(
    page.indexOf('.quota-provider:first-child'),
    -1,
    ':first-child on .quota-provider matches every header now that each sits in its own block',
  );
  assert.match(
    page,
    /\.quota-provider-block \+ \.quota-provider-block \.quota-provider\b/,
    'the divider must be drawn between consecutive provider blocks',
  );
});

test('an older Usage Monitor with no quotaGroups degrades instead of blanking', () => {
  const legacy = { generatedAt: payload.generatedAt, windows: payload.windows };
  const rows = quotaRows(legacy);
  assert.ok(rows.length > 0, 'the fallback must still produce rows');
  assert.ok(rows.every((r) => r.degraded === true), 'fallback rows must be flagged degraded so the panel can say so');

  // Degraded rows collapse windows on purpose; the renderer must not be able to
  // tell them apart from authoritative per-window rows.
  const grouped = quotaRows(payload);
  assert.ok(grouped.length > rows.length, 'the merged payload must yield more rows than the legacy one');
});

test('a missing or empty payload renders nothing rather than throwing', () => {
  for (const bad of [null, undefined, {}, { windows: [] }, { quotaGroups: [] }]) {
    const rows = quotaRows(bad);
    assert.ok(Array.isArray(rows), `quotaRows(${JSON.stringify(bad)}) must return an array`);
  }
});

test('the panel no longer computes a provider number from the raw windows array', () => {
  // Guard against the old code being reintroduced under a new name.
  assert.equal(
    page.indexOf('aggregateQuotas'),
    -1,
    'aggregateQuotas is gone; if a replacement min/mean over windows[] returns, it must consume quotaGroups',
  );
  assert.match(page, /payload\.quotaGroups/, 'the renderer must read quotaGroups off the payload');
});