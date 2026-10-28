// Vercel serverless function — the Fleet RAG panel, read live from the private services.
//
// WHY IT IS LIVE AND NOT A FILE
// The panel used to serve start/site-snapshot.json, a snapshot committed to this
// public repository.  That file carried the fleet's board item titles, so
// anyone with the repository could read them, and nothing this site does could
// change that.  The data now comes from the private services at request time:
// the board from Linear, through the fleet's own OAuth app, and the corpus
// numbers from recall behind Cloudflare Access.  Only the roster — the app list
// and the seat list, which the coordinator already publishes — stays in the
// repository.
//
// The shape is the shape the page already read, so the page itself did not
// change:  generatedAt, schema, components, seats, recentChanges and corpus.
//
// WHERE EACH FIELD COMES FROM
//   components[].hits   the corpus point count for that app, from recall
//   seats[].recentCount how many of the board rows below belong to that seat
//   recentChanges       the board rows:  finished items, newest first
//   corpus              the corpus counters, from recall
//
// Env:
//   RECALL_API_TOKEN         Bearer for the recall corpus
//   CF_ACCESS_CLIENT_ID      Cloudflare Access service token id for recall.jays.services
//   CF_ACCESS_CLIENT_SECRET  Cloudflare Access service token secret
//   LINEAR_CLIENT_ID         Linear OAuth client id (the fleet app)
//   LINEAR_CLIENT_SECRET     Linear OAuth client secret
//   RAG_UPSTREAM_TIMEOUT_MS  Optional.  How long an upstream may take, in
//                            milliseconds.  Defaults to 4000;  the tests set it
//                            low so the suite does not wait.

const ROSTER = require("../site-roster.json");

const RECALL_BASE = process.env.RECALL_API_BASE || "https://recall.jays.services";
const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";
const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";
// The board CLI's own scope string.  Asking Linear for a token with a different
// scope revokes every token that app holds, so this is a constant here and is
// never read from the environment.
const LINEAR_SCOPE = "read,write,app:assignable,app:mentionable";
const USER_AGENT = "swu-board-cli/1";

// How many board rows the panel shows, and how many board items are pulled to
// find them:  the board carries the owner's own items next to the fleet's, so
// the pool is wider than the rows.
const CHANGE_LIMIT = 12;
const BOARD_FETCH = 60;

// One minute of warmth.  The page asks on every load, and neither upstream
// needs to answer every time;  a minute is short enough that the panel is
// never meaningfully behind.
const CACHE_MS = 60_000;
// How long a good answer may be served after an upstream fails.
const STALE_MS = 30 * 60_000;
// A Linear token is good for hours; minting one costs a round trip.
const TOKEN_MS = 15 * 60_000;
// How long an upstream may take before the call is abandoned.  The function
// has ten seconds,  and the board's token call and the board query are
// sequential,  so two calls of four seconds still leave room for the stale
// answer to be served instead of the request running into the platform's own
// timeout.  A hung upstream must reach the catch,  not sit there.
const UPSTREAM_TIMEOUT_MS = Number(process.env.RAG_UPSTREAM_TIMEOUT_MS || 4000);

let cached = null; // { payload, at }
let tokenCache = null; // { token, at }

/** The signal that abandons a call to an upstream that stopped answering. */
function timeoutSignal(ms) {
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") return undefined;
  return AbortSignal.timeout(ms);
}

/** One uppercase tag out of a fleet seat label, or null. */
function seatFromLabels(labels) {
  const names = (labels || []).map((l) => String(l.name || ""));
  // A claim says who is on it; a seat label says who reported it.  The claim
  // is the better answer when both are there.
  const claim = names.find((n) => n.startsWith("claimed:"));
  if (claim) return claim.slice("claimed:".length).trim() || null;
  const seat = names.find((n) => n.startsWith("seat:"));
  if (seat) return seat.slice("seat:".length).trim() || null;
  return null;
}

/** The corpus slug a roster entry is counted under. */
function slugify(value) {
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase()
    .replace(/[._\s]+/g, "-");
}

/** The corpus counts for one app, or null when the corpus does not know it. */
function hitsFor(component, byApp) {
  const candidates = [component.slug, component.name].filter(Boolean).map(slugify);
  for (const key of candidates) {
    if (byApp && byApp[key] != null) return byApp[key];
  }
  return null;
}

async function recallStats() {
  const id = process.env.CF_ACCESS_CLIENT_ID;
  const secret = process.env.CF_ACCESS_CLIENT_SECRET;
  const token = process.env.RECALL_API_TOKEN;
  const missing = [];
  if (!id) missing.push("CF_ACCESS_CLIENT_ID");
  if (!secret) missing.push("CF_ACCESS_CLIENT_SECRET");
  if (!token) missing.push("RECALL_API_TOKEN");
  if (missing.length) throw new Error("missing corpus credentials: " + missing.join(", "));

  const r = await fetch(`${RECALL_BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "CF-Access-Client-Id": id,
      "CF-Access-Client-Secret": secret,
      Authorization: `Bearer ${token}`,
      "User-Agent": "start-jays-services/1.0 (+fleet-ops)",
    },
    signal: timeoutSignal(UPSTREAM_TIMEOUT_MS),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: "recall_stats", arguments: {} },
    }),
  });
  if (!r.ok) throw new Error("recall HTTP " + r.status);
  const raw = await r.json();
  if (raw.error) throw new Error("recall answered with an error");
  const text = raw.result?.content?.[0]?.text || "{}";
  const stats = JSON.parse(text);
  if (!stats || !stats.points) throw new Error("recall answered without corpus data");
  return stats;
}

async function linearToken() {
  if (tokenCache && Date.now() - tokenCache.at < TOKEN_MS) return tokenCache.token;
  const id = process.env.LINEAR_CLIENT_ID;
  const secret = process.env.LINEAR_CLIENT_SECRET;
  const missing = [];
  if (!id) missing.push("LINEAR_CLIENT_ID");
  if (!secret) missing.push("LINEAR_CLIENT_SECRET");
  if (missing.length) throw new Error("missing board credentials: " + missing.join(", "));

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: id,
    client_secret: secret,
    scope: LINEAR_SCOPE,
  });
  const r = await fetch(LINEAR_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
    body,
    signal: timeoutSignal(UPSTREAM_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error("board token HTTP " + r.status);
  const js = await r.json();
  if (!js.access_token) throw new Error("the board answered without a token");
  tokenCache = { token: js.access_token, at: Date.now() };
  return tokenCache.token;
}

const BOARD_QUERY = `
  query($n: Int!) {
    issues(first: $n, orderBy: updatedAt) {
      nodes {
        id
        title
        updatedAt
        state { name type }
        labels { nodes { name } }
      }
    }
  }
`;

async function boardRows() {
  const token = await linearToken();
  const r = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
    },
    signal: timeoutSignal(UPSTREAM_TIMEOUT_MS),
    body: JSON.stringify({ query: BOARD_QUERY, variables: { n: BOARD_FETCH } }),
  });
  if (!r.ok) throw new Error("board HTTP " + r.status);
  const js = await r.json();
  if (js.errors && js.errors.length) throw new Error("the board answered with an error");
  const nodes = js.data?.issues?.nodes || [];

  const rows = [];
  for (const node of nodes) {
    // A finished item is a change.  An item still in flight is not one yet.
    const type = (node.state || {}).type || "";
    if (type !== "completed") continue;
    const seat = seatFromLabels((node.labels || {}).nodes);
    // Without a seat there is nothing to attribute the row to, and the panel
    // shows a seat on every row.
    if (!seat) continue;
    const when = new Date(node.updatedAt || node.createdAt || Date.now());
    rows.push({
      date: when.toISOString().slice(0, 10),
      seat,
      title: String(node.title || "").replace(/\s+/g, " ").trim(),
    });
    if (rows.length >= CHANGE_LIMIT) break;
  }
  return rows;
}

/** The payload the page reads, assembled from the roster and the two upstreams. */
function compose(stats, rows) {
  const byApp = (stats && stats.by_app) || {};
  const counts = {};
  for (const row of rows) counts[row.seat] = (counts[row.seat] || 0) + 1;

  return {
    generatedAt: new Date().toISOString(),
    schema: 2,
    components: ROSTER.components.map((c) => ({ ...c, hits: hitsFor(c, byApp) })),
    seats: ROSTER.seats.map((s) => ({ ...s, recentCount: counts[s.tag] || 0 })),
    recentChanges: rows,
    corpus: {
      collection: (stats && stats.collection) || null,
      status: (stats && stats.status) || null,
      points: (stats && stats.points) || null,
      bySource: (stats && stats.by_source) || null,
      byApp: byApp,
    },
  };
}

async function load() {
  // The two upstreams are independent, so they are asked at the same time:  the
  // board answers in about a second and the corpus in about a third of one.
  const [stats, rows] = await Promise.all([recallStats(), boardRows()]);
  return compose(stats, rows);
}

module.exports = async function (req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  // Private operator data:  no persistence in shared or browser caches.
  res.setHeader("Cache-Control", "private, no-store");
  const origin = req.headers && req.headers.origin;
  if (origin === "https://home.jays.services") {
    res.setHeader("Access-Control-Allow-Origin", "https://home.jays.services");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://start.jays.services");
  }

  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) {
    res.setHeader("X-Rag-Age", String(Math.round((now - cached.at) / 1000)));
    res.status(200).json(cached.payload);
    return;
  }

  try {
    const payload = await load();
    cached = { payload, at: Date.now() };
    res.status(200).json(payload);
  } catch (err) {
    // A good answer beats an error page:  the last good one is served with a
    // header that says how old it is.  An upstream that is down for good must
    // not look like a board with no work on it.
    if (cached && now - cached.at < STALE_MS) {
      res.setHeader("X-Rag-Stale", String(Math.round((now - cached.at) / 1000)));
      res.status(200).json(cached.payload);
      return;
    }
    res.status(502).json({ error: "the fleet data could not be read", detail: String(err.message || err) });
  }
};
