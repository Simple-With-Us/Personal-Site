// Vercel serverless function — the fleet admin panel API (ported from the
// admin-jays-services Cloudflare Worker).  vercel.json rewrites
// /admin/api/:route* to /api/admin?route=:route*, so the shared handler in
// api/_admin/worker.mjs keeps seeing the /api/... paths it was written for.
// Every fleet token lives in this project's environment, never in the browser.
// The page itself (public/admin/) sits behind Vercel login like the rest of the site.

const { timingSafeEqual } = require("node:crypto");

let handler;

// The page is already behind Vercel login; this is a second, in-function gate so a
// protection change or bypass secret on the project cannot expose fleet tokens.
// Fails closed: with ADMIN_PANEL_TOKEN unset the API answers 503.
function authorized(req) {
  const expected = process.env.ADMIN_PANEL_TOKEN;
  if (!expected) return 503;
  const header = (req.headers && req.headers.authorization) || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? 200 : 401;
}

module.exports = async function (req, res) {
  const gate = authorized(req);
  if (gate !== 200) {
    res.setHeader("Cache-Control", "private, no-store");
    res.status(gate).json({ ok: false, error: gate === 503 ? "ADMIN_PANEL_TOKEN is not set on this project." : "Admin token required." });
    return;
  }
  handler = handler || (await import("./_admin/worker.mjs")).default;
  const incoming = new URL(req.url, "https://admin.invalid");
  const route = incoming.searchParams.get("route") || "";
  incoming.searchParams.delete("route");
  const target = new URL(`/api/${route}`, "https://admin.invalid");
  target.search = incoming.search;
  const response = await handler.fetch(new Request(target, { method: req.method }), process.env);
  res.status(response.status);
  res.setHeader("Content-Type", response.headers.get("Content-Type") || "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.send(Buffer.from(await response.arrayBuffer()));
};
