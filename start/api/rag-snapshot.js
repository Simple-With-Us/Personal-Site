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
// WHERE EACH FIELD COMES FROM
//   components[].hits   the corpus point count for that app, from recall
//   seats[].recentCount how many items that seat closed inside the window
//   seats                ranked by that count, which is what "Top Seats" means
//   recentChanges       the newest finished board items, dated by the day they
//                       were finished rather than the day they were last touched
//   corpus              the corpus counters, from recall
//
// The shape is the shape the page already read, so the page itself did not
// change:  generatedAt, schema, components, seats, recentChanges and corpus.
//
// Env:
//   RECALL_API_BASE           Base URL of the corpus service.  There is no
//                             default:  the address stays in the project's
//                             environment and not in a public repository.
//   RECALL_API_TOKEN          Bearer for the corpus
//   CF_ACCESS_CLIENT_ID       Cloudflare Access service token id
//   CF_ACCESS_CLIENT_SECRET   Cloudflare Access service token secret
//   LINEAR_CLIENT_ID          Linear OAuth client id (the fleet app)
//   LINEAR_CLIENT_SECRET      Linear OAuth client secret
//   RAG_UPSTREAM_TIMEOUT_MS   Optional.  How long an upstream may take, in
//                             milliseconds.  Defaults to 4000.
//   RAG_CHANGE_SINCE_DAYS     Optional.  The window the seat counts cover.
//                             Defaults to 14, which is what the panel says.

const ROSTER = require("../site-roster.json");

const RECALL_BASE = process.env.RECALL_API_BASE || "";
const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";
const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";
// The board CLI's own scope string.  Asking Linear for a token with a different
// scope revokes every token that app holds, so this is a constant here and is
// never read from the environment.
const LINEAR_SCOPE = "read,write,app:assignable,app:mentionable";
const USER_AGENT = "swu-board-cli/1";

// How many board rows the panel shows,  and how many board items are pulled to
// find them.  The seat counts and the rows come from the same set,  because a
// count over a different set than the rows beside it would disagree with them.
const CHANGE_LIMIT = 12;
const BOARD_FETCH = 250;
// The window the counts cover.  The panel's column heading says "Top Seats
// (14d)",  so the count has to be a fortnight and not "however many items the
// query happened to return".
const CHANGE_SINCE_DAYS = Number(process.env.RAG_CHANGE_SINCE_DAYS || 14);

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

// Minimax is called both things,  and they are the same seat.  The alias maps
// one spelling onto the other before anything is counted,  so a board item
// filed as "seat:Minimax" is credited to the seat the roster calls MM.
const SEAT_ALIASES = { MINIMAX: "MM" };

let cached = null; // { payload, at }
let pending = null; // the fan-out in flight, shared by whoever asked first
let tokenCache = null; // { token, at }

/** The signal that abandons a call to an upstream that stopped answering. */
function timeoutSignal(ms) {
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") return undefined;
  return AbortSignal.timeout(ms);
}

/**
 * A masked preview of a credential:  the first eight and the last four
 * characters.  Enough to tell two keys apart when one of them is refused,
 * useless to anyone who is not the owner.  Never the key itself.
 */
function maskedPreview(value) {
  const text = String(value == null ? "" : value);
  if (text.length < 12) return "a short credential (" + text.length + " characters)";
  return text.slice(0, 8) + "..." + text.slice(-4);
}

/** A credential the upstream refused.  The preview is the only part that leaves. */
function credentialError(message, options = {}) {
  const error = new Error(message);
  error.code = "PROVIDER_CREDENTIAL_ERROR";
  error.maskedPreview = options.maskedPreview || null;
  return error;
}

/** A credential that was never configured.  The names are for the log only. */
function missingCredentialError(names) {
  const error = new Error("missing credentials: " + names.join(", "));
  error.code = "MISSING_CREDENTIAL";
  error.missing = names.slice();
  return error;
}

/** A value the project was supposed to carry and does not. */
function missingConfigurationError(name) {
  const error = new Error("missing configuration: " + name);
  error.code = "MISSING_CONFIGURATION";
  error.missing = [name];
  return error;
}

/**
 * What the caller is told when an upstream fails.  The upstream's own words
 * and the names of the missing variables stay in the function's log:  a body
 * can be read by anyone who gets past the gate,  and a diagnostic that names
 * a configuration variable belongs in the log where the owner will look for
 * it.  A refused credential is reported as a masked preview,  which is the one
 * case where naming the thing helps and leaks nothing.
 */
function publicDetail(error) {
  if (error && error.code === "PROVIDER_CREDENTIAL_ERROR") {
    return "the credential was refused" + (error.maskedPreview ? " (" + error.maskedPreview + ")" : "");
  }
  if (error && error.code === "MISSING_CREDENTIAL") return "a required credential is not configured";
  if (error && error.code === "MISSING_CONFIGURATION") return "a required configuration value is not set";
  return "the upstream did not answer";
}

/** One spelling for a seat,  or null when the value is not a seat at all. */
function normalizeSeat(value) {
  const tag = String(value == null ? "" : value).trim().toUpperCase();
  // FLEET is a broadcast,  never a seat:  a chip reading FLEET credits nobody.
  if (!tag || tag === "FLEET") return null;
  return SEAT_ALIASES[tag] || tag;
}

/**
 * The seat of a board item.  A claim label says who is on it,  so it wins;  a
 * seat label says who filed it.  The older items name the seat in the title
 * instead,  and that title is the last word.
 */
function seatOf(node) {
  const names = ((node.labels || {}).nodes || []).map((l) => String(l.name || ""));
  const claim = names.find((n) => n.startsWith("claimed:"));
  if (claim) return normalizeSeat(claim.slice("claimed:".length));
  const seat = names.find((n) => n.startsWith("seat:"));
  if (seat) return normalizeSeat(seat.slice("seat:".length));
  return seatFromTitle(node.title);
}

/**
 * The seat an older board item names in its own title:
 * "2026-10-03 — CODEX — COMPLETED — …"  or  "[CLAUDE][Harness] …".
 */
function seatFromTitle(title) {
  const text = String(title || "");
  const dashed = text.match(/^\d{4}-\d{2}-\d{2}\s*[—–-]{1,2}\s*([A-Z][A-Z0-9-]{1,14})\s*[—–-]{1,2}/);
  if (dashed) return normalizeSeat(dashed[1]);
  const bracketed = text.match(/^\[([A-Z][A-Z0-9-]{1,14})\]/);
  if (bracketed) return normalizeSeat(bracketed[1]);
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

/**
 * The corpus's reply.  The endpoint advertises JSON and an event stream,  and
 * a server that answers with the stream wraps its reply in "data:" lines.
 */
function parseMcpReply(text) {
  const body = String(text || "").trim();
  if (!body) throw new Error("the corpus answered with nothing");
  if (!body.startsWith("data:")) return JSON.parse(body);
  const payloads = body
    .split("\n")
    .map((line) => line.replace(/^data:\s*/, "").trim())
    .filter((line) => line && line !== "[DONE]");
  for (const payload of payloads) {
    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch {
      continue;
    }
    if (parsed && (parsed.result || parsed.error)) return parsed;
  }
  throw new Error("the corpus answered with an unreadable stream");
}

async function recallStats() {
  if (!RECALL_BASE) throw missingConfigurationError("RECALL_API_BASE");
  const id = process.env.CF_ACCESS_CLIENT_ID;
  const secret = process.env.CF_ACCESS_CLIENT_SECRET;
  const token = process.env.RECALL_API_TOKEN;
  const missing = [];
  if (!id) missing.push("CF_ACCESS_CLIENT_ID");
  if (!secret) missing.push("CF_ACCESS_CLIENT_SECRET");
  if (!token) missing.push("RECALL_API_TOKEN");
  if (missing.length) throw missingCredentialError(missing);

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
  if (r.status === 401 || r.status === 403) {
    throw credentialError("the corpus refused the credential", { maskedPreview: maskedPreview(token) });
  }
  if (!r.ok) throw new Error("recall HTTP " + r.status);
  const raw = parseMcpReply(await r.text());
  if (raw.error) throw new Error("recall answered with an error");
  const text = (raw.result && raw.result.content && raw.result.content[0] && raw.result.content[0].text) || "{}";
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
  if (missing.length) throw missingCredentialError(missing);

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
  if (r.status === 401 || r.status === 403) {
    throw credentialError("the board refused the credential", { maskedPreview: maskedPreview(secret) });
  }
  if (!r.ok) throw new Error("board token HTTP " + r.status);
  const js = await r.json();
  if (!js.access_token) throw new Error("the board answered without a token");
  tokenCache = { token: js.access_token, at: Date.now() };
  return tokenCache.token;
}

const BOARD_QUERY = `
  query($n: Int!, $since: DateTimeOrDuration) {
    issues(
      first: $n
      orderBy: updatedAt
      filter: { completedAt: { gte: $since } }
    ) {
      nodes {
        id
        title
        createdAt
        updatedAt
        completedAt
        state { name type }
        labels { nodes { name } }
      }
    }
  }
`;

/**
 * Every board item finished inside the window,  newest first.  The date is the
 * day the item was finished:  an item that was finished three weeks ago and
 * touched yesterday is not a change of yesterday.
 */
async function boardRows() {
  const token = await linearToken();
  const since = new Date(Date.now() - CHANGE_SINCE_DAYS * 86400000).toISOString();
  const r = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
    },
    signal: timeoutSignal(UPSTREAM_TIMEOUT_MS),
    body: JSON.stringify({ query: BOARD_QUERY, variables: { n: BOARD_FETCH, since } }),
  });
  if (r.status === 401 || r.status === 403) {
    throw credentialError("the board refused the credential", { maskedPreview: maskedPreview(token) });
  }
  if (!r.ok) throw new Error("board HTTP " + r.status);
  const js = await r.json();
  if (js.errors && js.errors.length) throw new Error("the board answered with an error");
  const nodes = (js.data && js.data.issues && js.data.issues.nodes) || [];

  const rows = [];
  for (const node of nodes) {
    // A finished item is a change.  An item still in flight is not one yet.
    const type = (node.state || {}).type || "";
    if (type !== "completed") continue;
    const seat = seatOf(node);
    // Without a seat there is nothing to attribute the row to, and the panel
    // shows a seat on every row.
    if (!seat) continue;
    const when = node.completedAt || node.updatedAt || node.createdAt;
    if (!when) continue;
    rows.push({
      date: new Date(when).toISOString().slice(0, 10),
      seat,
      title: String(node.title || "").replace(/\s+/g, " ").trim(),
    });
  }
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return rows;
}

/** The payload the page reads, assembled from the roster and the two upstreams. */
function compose(stats, rows) {
  const byApp = (stats && stats.by_app) || {};

  // The counts and the rows come from the same set,  so the bar chart beside
  // the list cannot disagree with it.
  const counts = {};
  for (const seat of ROSTER.seats) counts[seat.tag] = 0;
  for (const row of rows) {
    if (counts[row.seat] != null) counts[row.seat] += 1;
  }
  // Ranked by the count:  the column is called "Top Seats".
  const seats = ROSTER.seats
    .map((s) => ({ ...s, recentCount: counts[s.tag] || 0 }))
    .sort((a, b) => b.recentCount - a.recentCount);

  return {
    generatedAt: new Date().toISOString(),
    schema: 2,
    components: ROSTER.components.map((c) => ({ ...c, hits: hitsFor(c, byApp) })),
    seats,
    recentChanges: rows.slice(0, CHANGE_LIMIT),
    corpus: {
      collection: (stats && stats.collection) || null,
      status: (stats && stats.status) || null,
      points: (stats && stats.points) || null,
      bySource: (stats && stats.by_source) || null,
      byApp: byApp,
    },
  };
}

/**
 * The fan-out,  shared.  Two readers arriving on a cold cache must not make
 * two trips to the corpus and the board:  the second one waits for the first
 * one's answer.
 */
function load() {
  if (!pending) {
    pending = Promise.all([recallStats(), boardRows()])
      .then(([stats, rows]) => compose(stats, rows))
      .finally(() => {
        pending = null;
      });
  }
  return pending;
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
    // The detail belongs in the log,  where the owner reads it.
    console.error("[rag-snapshot] " + String((err && err.stack) || err));
    // A good answer beats an error page:  the last good one is served with a
    // header that says how old it is.  An upstream that is down for good must
    // not look like a board with no work on it.
    if (cached && now - cached.at < STALE_MS) {
      res.setHeader("X-Rag-Stale", String(Math.round((now - cached.at) / 1000)));
      res.status(200).json(cached.payload);
      return;
    }
    res.status(502).json({ error: "the fleet data could not be read", detail: publicDetail(err) });
  }
};
