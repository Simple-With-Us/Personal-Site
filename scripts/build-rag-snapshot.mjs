#!/usr/bin/env node
// Build the Fleet RAG snapshot that powers https://home.jays.services.
//
// Usage:
//   node scripts/build-rag-snapshot.mjs                    # read the corpus over HTTP (needs RECALL_API_TOKEN + CF Access headers)
//   node scripts/build-rag-snapshot.mjs --from-local       # shell out to the local `recall` CLI; no credentials at all
//   node scripts/build-rag-snapshot.mjs --seed path.json   # merge a hand-curated seed JSON into the result
//
// Output: writes /start/site-snapshot.json, next to the site that serves it.
// Override the destination with SNAPSHOT_OUT.
//
// WHY THE LOCAL PATH IS THE DEFAULT ON THE MAC
// The corpus lives on Jay's Mac (Qdrant + TEI).  A GitHub runner can only read
// it by traversing Cloudflare Access with a service-token pair that this repo
// never had set — so the scheduled build authenticated with nothing, got a 302
// HTML login page back, failed to parse it as JSON, and the validate step killed
// the run.  Twelve consecutive daily runs failed that way (2026-09-22 to
// 2026-10-03) and the committed snapshot froze at 2026-09-28.  The `recall` CLI
// is the fleet's own Mac-side interface and needs no credential, so the local
// path is the one that can actually run where the data is.
//
// The HTTP path is kept for anywhere the corpus is reachable over the network and
// the Access token pair is present.  If neither path yields corpus data the
// script exits non-zero instead of writing an empty snapshot over good data.

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const OUT_PATH = process.env.SNAPSHOT_OUT
  ? resolve(process.env.SNAPSHOT_OUT)
  : resolve(REPO_ROOT, "start/site-snapshot.json");
const SEED_FLAG = process.argv.includes("--seed");
const SEED_PATH = SEED_FLAG ? process.argv[process.argv.indexOf("--seed") + 1] : null;
const FROM_LOCAL = process.argv.includes("--from-local");

// The Mac's own fleet-recall CLI.  RECALL_CLI overrides it for a non-standard
// checkout; the default is the canonical path the fleet docs name.
const RECALL_CLI = process.env.RECALL_CLI || resolve(homedir(), "apps/fleet-rag/recall");

// recall.jays.services is the canonical public hop (Hetzner, survives the Mac
// sleeping); agents.jays.services is the Mac-side hop.  Old builds hard-coded
// the Mac hop, which is the one that goes away when the Mac sleeps.
const RECALL_API_BASE = process.env.RECALL_API_BASE || "https://recall.jays.services";

// Board rows are dated and seat-attributed, which is exactly what the card
// renders.  Searching the whole corpus with one bag-of-words query returns the
// handful of old high-scoring documents that happen to share vocabulary with
// it, which is how the feed ended up showing one entry every few days.
const CHANGE_QUERIES = [
  "COMPLETED DEPLOYED",
  "COMPLETED MERGED",
  "shipped verified prod",
  "closeout landed",
];
const CHANGE_SINCE_DAYS = Number(process.env.SNAPSHOT_SINCE_DAYS || 14);
const CHANGE_LIMIT = Number(process.env.SNAPSHOT_CHANGE_LIMIT || 12);

function cfHeaders() {
  const id = process.env.CF_ACCESS_CLIENT_ID;
  const secret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (!id || !secret) return null;
  return { "CF-Access-Client-Id": id, "CF-Access-Client-Secret": secret };
}

async function callMcp(method, params) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...(cfHeaders() || {}),
  };
  if (process.env.RECALL_API_TOKEN) headers.Authorization = `Bearer ${process.env.RECALL_API_TOKEN}`;
  const r = await fetch(`${RECALL_API_BASE}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  if (!r.ok) throw new Error("MCP HTTP " + r.status);
  return r.json();
}

async function remoteStats() {
  const r = await callMcp("tools/call", { name: "recall_stats", arguments: {} });
  return JSON.parse(r.result?.content?.[0]?.text || "{}");
}

async function remoteSearch(query, limit, sinceDays) {
  const r = await callMcp("tools/call", {
    name: "recall_search",
    arguments: { query, limit, since_days: sinceDays, source: "board" },
  });
  const payload = JSON.parse(r.result?.content?.[0]?.text || "{}");
  return payload.hits || [];
}

// ---- Local CLI path -------------------------------------------------------
// `recall … --json` is the fleet's Mac-side interface; it reads the same corpus
// through the same config the ingest uses, so it needs no token of any kind.

function localJson(args) {
  const out = execFileSync(RECALL_CLI, args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(out);
}

function localStats() {
  return localJson(["stats", "--json"]);
}

function localSearch(query, limit, sinceDays) {
  const payload = localJson([
    "search", query,
    "--limit", String(limit),
    "--source", "board",
    "--since-days", String(sinceDays),
    "--json",
  ]);
  return payload.hits || [];
}

// ---- Roster ---------------------------------------------------------------
// The hand-curated fleet component list.  Only the fields the card renders are
// kept.  An existing snapshot's roster wins over this one, so a rename upstream
// cannot silently blank a row that the committed snapshot still had right.
//
// `slug` is the key the recall corpus actually files points under
// (corpus.by_app), and it is stated rather than derived.  The card's `name` is a
// display string that need not be a slug at all — "Socratic.Trade" files under
// "socratic-trade", "Usage Monitor" under "usage-monitor", and
// "ai-fleet-coordinator" under the catch-all "fleet" bucket.  Guessing the key
// from the name was the bug behind the card reading 0 for components that hold
// tens of thousands of points; see attachHits below.

const COMPONENTS = [
  // `icon` is the app's own AppIcon asset, copied by scripts/sync-logos.mjs.
  // A component with no shipped icon keeps the monogram tile rather than an
  // empty square — but "no icon" has to mean that no icon exists, not that the
  // row was missed: congress-trading-shared is a contract library and
  // fleet-ops is a private ops inventory, and neither has app art of its own.
  { acronym: "ST",  name: "Socratic.Trade",           tagline: "Agentic trading console",      url: "https://socratictrade.com",     icon: "app-st.png",     slug: "socratic-trade" },
  { acronym: "CT",  name: "Congress.Trade",           tagline: "Public STOCK Act disclosures", url: "https://congress.trade",       icon: "app-ct.png",     slug: "congress-trade" },
  { acronym: "UM",  name: "Usage Monitor",            tagline: "API + agent quota + spend",    url: "https://usage.jays.services",  icon: "app-um.png",     slug: "usage-monitor" },
  { acronym: "BF",  name: "BotFleet",                 tagline: "Pick a platform per bot",      url: "https://botfleet.app",         icon: "app-bf.png",     slug: "botfleet" },
  { acronym: "DD",  name: "DealDex",                  tagline: "Pokemon listing desk",         url: "https://dealdex.net",           icon: "app-dd.png",     slug: "dealdex" },
  { acronym: "CL",  name: "ContactLogo",              tagline: "Brand icons for contacts",     url: "https://contactlogo.com",       icon: "app-cl.png",     slug: "contactlogo" },
  { acronym: "AR",  name: "Autorotate",               tagline: "Zero-plaintext secret rotation", url: "https://autorotate.codes",    icon: "app-ar.png",     slug: "autorotate" },
  { acronym: "CTS", name: "congress-trading-shared", tagline: "Shared TS contracts",          url: null,                          icon: null,            slug: "congress-trading-shared" },
  // AFC, not AFL: owner ruling 2026-10-11.  AFL is a retired coordinator alias.
  // Filed under "fleet": the corpus attributes coordinator and general fleet
  // docs to one bucket rather than to the repo slug.
  { acronym: "AFC", name: "ai-fleet-coordinator",     tagline: "Fleet coordination",           url: null,                          icon: "app-afc.png",    slug: "fleet" },
  { acronym: "OPS", name: "fleet-ops",                tagline: "Private ops inventory",        url: null,                          icon: null,            slug: "fleet-ops" },
  { acronym: "PS",  name: "Personal-Site",            tagline: "jays.services portfolio",     url: "https://jays.services",        icon: "app-ps.png",     slug: "personal-site" },
];

// Seats are the coding identities the card credits.  `mark` is a file in
// public/logos/, synced from CodeCaps' ProviderMarks by scripts/sync-logos.mjs.
// Grok is the Grok logo — not the Grok Web/iOS app icon, which is a black tile
// and belongs on an app surface — and Grok Bot keeps its own mark.  A seat with
// no mark keeps its text tag rather than borrowing a neighbouring brand's.
const SEATS = [
  { tag: "GROK",    fullName: "xAI Grok",             color: "#1F1F1F", mark: "grok-color.png" },
  { tag: "CLAUDE",  fullName: "Claude / Anthropic",   color: "#D97757", mark: "claude-color.png" },
  { tag: "CURSOR",  fullName: "Cursor",               color: "#7C3AED", mark: "cursor-color.png" },
  { tag: "CODEX",   fullName: "OpenAI Codex",         color: "#10A37F", mark: "openai-color.png" },
  { tag: "MONET",   fullName: "Monet",                color: "#0EA5E9", mark: "monet.svg" },
  { tag: "AG",      fullName: "Antigravity / Gemini", color: "#4285F4", mark: "gemini-color.png" },
  { tag: "MM",      fullName: "Mavis (MM)",           color: "#FF6B35", mark: "minimax.png" },
  { tag: "FX",      fullName: "Firefox fleet seat",   color: "#8B5CF6", mark: null },
];

// Seats that show up in corpus rows without being a Top-Seats bar still get a
// mark, so a credited change never falls back to a bare coloured pill.
const SEAT_MARKS = {
  ...Object.fromEntries(SEATS.map(s => [s.tag, s.mark])),
  MINIMAX: "minimax.png",
  GEMINI: "gemini-color.png",
  DEEPSEEK: "deepseek.svg",
  KIMI: "kimi.svg",
  HARNESS: null,
  RENOIR: "renoir.svg",
  MUSE: "muse-assist-color.png",
  "GROK-BOT": "grok-bot-color.png",
  "BF-DIRECTOR": "grok-bot-color.png",
  "BF-FIXER": "grok-bot-color.png",
  "BF-PLUMBER": "grok-bot-color.png",
};

// The corpus attributes a board row to whoever filed it, which for most rows is
// the FLEET digest rather than the seat that did the work — a row titled
// "2026-10-03 — CODEX — COMPLETED — …" carries seat "FLEET".  The board's own
// title format names the real seat, so read it from there.  FLEET is deliberately
// not accepted as an answer: it is a broadcast wake, never a seat signature, and
// a chip reading FLEET credits nobody.
function seatFromTitle(title) {
  const text = String(title || "");
  // "2026-10-03 — CODEX — COMPLETED — …"  /  "2026-10-01 - AG - COMPLETED - …"
  const dashed = text.match(/^\d{4}-\d{2}-\d{2}\s*[—–-]{1,2}\s*([A-Z][A-Z0-9-]{1,14})\s*[—–-]{1,2}/);
  if (dashed && dashed[1] !== "FLEET") return dashed[1];
  // "[CLAUDE][Harness] …"  /  "[BF][MINIMAX] …"
  const bracketed = text.match(/^\[([A-Z][A-Z0-9-]{1,14})\]/);
  if (bracketed && bracketed[1] !== "FLEET") return bracketed[1];
  return null;
}

function seatFromHit(hit) {
  const fromTitle = seatFromTitle(hit.title || hit.heading);
  if (fromTitle) return fromTitle;
  const tagged = String(hit.seat || "").trim();
  return tagged && tagged !== "FLEET" ? tagged : "";
}

function aggregateSeats(hits) {
  const counts = Object.fromEntries(SEATS.map(s => [s.tag, 0]));
  for (const h of hits) {
    // Count the same attribution the change rows carry, or the bar chart
    // disagrees with the list it sits next to — AG showed 0 changes beside three
    // AG rows when this read the raw corpus seat.
    const seat = seatFromHit(h);
    if (counts[seat] != null) counts[seat] += 1;
  }
  return SEATS.map(s => ({ ...s, recentCount: counts[s.tag] || 0 }))
    .sort((a, b) => b.recentCount - a.recentCount);
}

function seatMark(tag) {
  if (!tag) return null;
  return SEAT_MARKS[String(tag).trim().toUpperCase().replace(/-/g, "")] ?? null;
}

// The old builder pulled the date out of the row body with a regex and fell back
// to "today" when no date was in the text, then sorted on that.  Board rows are
// titled "YYYY-MM-DD — SEAT — …" but not every corpus document is, so the feed
// inherited whatever date happened to be mentioned first and rows without one
// all collapsed onto the build date.  created_at is the document's own
// timestamp and is the only field that can order a feed honestly.
function isoDate(hit) {
  const raw = Number(hit.created_at);
  if (Number.isFinite(raw) && raw > 0) {
    const ms = raw > 1e12 ? raw : raw * 1000; // tolerate seconds
    return new Date(ms).toISOString().slice(0, 10);
  }
  return null;
}

function extractChanges(hits) {
  const seen = new Set();
  const out = [];
  for (const h of hits) {
    const date = isoDate(h);
    if (!date) continue;
    const title = String(h.title || h.heading || "").replace(/\s+/g, " ").trim();
    if (!title) continue;
    // One row per document: the same board item matched by several queries is
    // one change, not several.
    const key = h.doc_id || title;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      date,
      seat: seatFromHit(h),
      app: h.app || "",
      title: title.length > 120 ? title.slice(0, 117) + "…" : title,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, CHANGE_LIMIT);
}

// Corpus slugs are hyphenated lowercase; a display name may carry dots, spaces
// or mixed case.  Normalise a candidate so a roster entry that predates an
// explicit `slug` still resolves instead of quietly reporting 0.
function slugify(value) {
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase()
    .replace(/[._\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function attachHits(components, byApp) {
  return components.map(c => {
    // The stated slug first, then the display name as a slug.  The acronym is
    // deliberately not a lookup key: "ST" is a display monogram, not a corpus
    // slug, and treating it as one is what let the card read 0 for components
    // holding tens of thousands of points.
    const candidates = [c.slug, c.name].filter(Boolean).map(slugify);
    let hits = 0;
    for (const key of candidates) {
      if (byApp[key] != null) { hits = byApp[key]; break; }
    }
    if (!hits && candidates.length) {
      // A roster row that resolves to nothing is a data bug, not an empty app.
      // Say so on stderr so the next build surfaces it instead of shipping a
      // card that claims a live app has no corpus presence.
      console.warn(
        `[snapshot] no corpus points for ${c.acronym} (${c.name}); tried ${candidates.join(", ")}`,
      );
    }
    return { ...c, hits };
  });
}

// Keep whatever the committed snapshot already knew about each component (a
// name, a tagline, an icon) and only refresh the number that actually moves.
function mergeRoster(previous, fallback) {
  if (!Array.isArray(previous) || !previous.length) return fallback;
  const byAcronym = new Map(previous.map(c => [c.acronym, c]));
  return fallback.map(c => {
    const prior = byAcronym.get(c.acronym);
    if (!prior) return c;
    return {
      ...c,
      // An icon added upstream wins; never drop one the snapshot already had.
      icon: c.icon || prior.icon || null,
      name: prior.name || c.name,
      tagline: prior.tagline || c.tagline,
    };
  });
}

async function build() {
  const seed = SEED_PATH && existsSync(SEED_PATH) ? JSON.parse(readFileSync(SEED_PATH, "utf8")) : null;
  const prior = existsSync(OUT_PATH) ? JSON.parse(readFileSync(OUT_PATH, "utf8")) : null;

  let stats = null;
  let hits = [];
  const read = FROM_LOCAL
    ? { stats: localStats, search: localSearch }
    : { stats: remoteStats, search: remoteSearch };

  if (FROM_LOCAL) {
    if (!existsSync(RECALL_CLI)) {
      throw new Error(`--from-local needs the recall CLI at ${RECALL_CLI}; set RECALL_CLI to override`);
    }
  }

  try {
    stats = await read.stats();
  } catch (err) {
    console.warn(`[snapshot] recall_stats failed via ${FROM_LOCAL ? "local CLI" : RECALL_API_BASE} ->`, err.message);
  }

  for (const q of CHANGE_QUERIES) {
    try {
      hits.push(...(await read.search(q, 12, CHANGE_SINCE_DAYS)));
    } catch (err) {
      console.warn(`[snapshot] recall_search failed for ${JSON.stringify(q)} ->`, err.message);
    }
  }

  const byApp = (stats && stats.by_app) || {};
  const components = attachHits(mergeRoster(prior?.components, COMPONENTS), byApp);
  const seats = aggregateSeats(hits);
  const recentChanges = extractChanges(hits);

  // Refuse to publish a gutted snapshot.  The old script wrote an empty file and
  // let a later CI step notice, which is how a broken upstream stayed invisible
  // for twelve days.
  if (!stats || !stats.points) {
    throw new Error("no corpus data from " + (FROM_LOCAL ? "the local recall CLI" : RECALL_API_BASE) + " — refusing to overwrite the committed snapshot");
  }
  if (!recentChanges.length) {
    throw new Error("no recent changes from " + (FROM_LOCAL ? "the local recall CLI" : RECALL_API_BASE) + " — refusing to overwrite the committed snapshot");
  }

  const out = {
    generatedAt: new Date().toISOString(),
    schema: 2,
    components: seed?.components || components,
    seats: seed?.seats || seats,
    recentChanges: seed?.recentChanges || recentChanges,
    corpus: {
      collection: stats.collection,
      status: stats.status,
      points: stats.points,
      bySource: stats.by_source,
      byApp: stats.by_app,
    },
  };

  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`[snapshot] wrote ${OUT_PATH}`);
  console.log(`[snapshot] source=${FROM_LOCAL ? "local-cli" : RECALL_API_BASE} components=${out.components.length} seats=${out.seats.length} changes=${out.recentChanges.length} points=${out.corpus.points}`);
  const newest = out.recentChanges[0]?.date;
  if (newest) {
    const age = Math.round((Date.now() - Date.parse(newest + "T00:00:00Z")) / 86400000);
    console.log(`[snapshot] newest change row: ${newest} (${age}d old)`);
  }
}

// Running as a script builds the snapshot; importing it (the unit test does)
// only exposes the pure helpers, so a test never rewrites site-snapshot.json.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch(err => {
    console.error("[snapshot] fatal:", err.message || err);
    process.exit(1);
  });
}

export { attachHits, slugify, COMPONENTS };
