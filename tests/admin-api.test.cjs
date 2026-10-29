const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ADMIN_PANEL_TOKEN = 'test-token';
const handler = require('../start/api/admin.js');

function call(url, headers = { authorization: 'Bearer test-token' }) {
  return new Promise((resolve, reject) => {
    const res = {
      headers: {},
      status(code) { this.code = code; return this; },
      setHeader(k, v) { this.headers[k] = v; },
      json(obj) { resolve({ code: this.code, headers: this.headers, body: JSON.stringify(obj) }); },
      send(body) { resolve({ code: this.code, headers: this.headers, body: body.toString() }); },
    };
    handler({ url, method: 'GET', headers }, res).catch(reject);
  });
}

test('/admin/api/sections lists the panel sections through the rewrite shape', async () => {
  const out = await call('/api/admin?route=sections');
  assert.equal(out.code, 200);
  assert.equal(out.headers['Cache-Control'], 'private, no-store');
  assert.ok(JSON.parse(out.body).sections.includes('endpoints'));
});

test('unknown routes answer 404 JSON, never a static fallback', async () => {
  const out = await call('/api/admin?route=nope');
  assert.equal(out.code, 404);
  assert.equal(JSON.parse(out.body).ok, false);
});

test('a section with no secret reads Not configured instead of failing the page', async () => {
  const out = await call('/api/admin?route=status&section=coolify');
  assert.equal(out.code, 200);
  assert.match(out.body, /Not configured|COOLIFY_TOKEN/);
});

test('the API refuses a missing or wrong token, and fails closed when none is configured', async () => {
  assert.equal((await call('/api/admin?route=sections', {})).code, 401);
  assert.equal((await call('/api/admin?route=sections', { authorization: 'Bearer nope' })).code, 401);
  const saved = process.env.ADMIN_PANEL_TOKEN;
  delete process.env.ADMIN_PANEL_TOKEN;
  try {
    assert.equal((await call('/api/admin?route=sections')).code, 503);
  } finally {
    process.env.ADMIN_PANEL_TOKEN = saved;
  }
});
