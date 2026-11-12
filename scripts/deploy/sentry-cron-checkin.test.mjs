import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP,
  MONITORS,
  MONITOR_INTERVAL_HOURS,
  CHECKIN_MARGIN_MINUTES,
  MAX_RUNTIME_MINUTES,
  slugify,
  expectedSlug,
  monitorSlug,
  missAfterMinutes,
  monitorConfig,
  checkInId,
  terminalStatus,
  parseDsn,
  buildPlan,
  envelopeBody,
  main,
} from './sentry-cron-checkin.mjs';

const MAIN = 'Vercel production catch-up';
const START = 'Vercel production catch-up (start)';

function env(overrides) {
  return {
    GITHUB_WORKFLOW: MAIN,
    GITHUB_EVENT_NAME: 'schedule',
    GITHUB_RUN_ID: '43116268679',
    GITHUB_RUN_ATTEMPT: '1',
    GITHUB_REPOSITORY: 'Simple-With-Us/Personal-Site',
    GITHUB_REF_NAME: 'main',
    GITHUB_ACTOR: 'example',
    GITHUB_SERVER_URL: 'https://github.com',
    TEST_RESULT: 'success',
    DEPLOY_RESULT: 'skipped',
    CRON_CHECKIN_PHASE: 'close',
    ...overrides,
  };
}

test('each workflow keeps the slug its monitor already has', () => {
  assert.equal(slugify(MAIN), 'vercel-production-catch-up');
  assert.equal(slugify(START), 'vercel-production-catch-up-start');
  for (const [name, slug] of Object.entries(MONITORS)) {
    assert.equal(slug, expectedSlug(name));
    assert.equal(monitorSlug(name), slug);
    assert.equal(slug.startsWith(`ci-${APP}-`), true);
  }
  assert.equal(monitorSlug('CI'), null);
  assert.notEqual(MONITORS[MAIN], MONITORS[START]);
});

test('monitor interval covers the measured delivery and still alerts within a day', () => {
  const config = monitorConfig();
  assert.deepEqual(config.schedule, { type: 'interval', value: MONITOR_INTERVAL_HOURS, unit: 'hour' });
  assert.equal(config.checkin_margin, CHECKIN_MARGIN_MINUTES);
  assert.equal(config.max_runtime, MAX_RUNTIME_MINUTES);
  assert.equal(config.timezone, 'UTC');
  assert.equal(MONITOR_INTERVAL_HOURS, 12);
  assert.equal(CHECKIN_MARGIN_MINUTES, 120);
  assert.equal(MAX_RUNTIME_MINUTES, 60);
  // Longest observed schedule gap was 10.62h. A 15h silence is a real miss.
  assert.ok(missAfterMinutes() >= Math.ceil(10.62 * 60));
  assert.ok(missAfterMinutes() < 24 * 60);
  assert.equal(missAfterMinutes(), 12 * 60 + 120);
});

test('open and close share one check-in id per run attempt', () => {
  const open = buildPlan(env({ CRON_CHECKIN_PHASE: 'open' }));
  const close = buildPlan(env({ CRON_CHECKIN_PHASE: 'close' }));
  assert.equal(open.items.length, 1);
  assert.equal(open.items[0].payload.status, 'in_progress');
  assert.equal(close.items.length, 1);
  assert.equal(close.items[0].payload.status, 'ok');
  assert.equal(open.items[0].payload.check_in_id, close.items[0].payload.check_in_id);
  assert.equal(open.items[0].payload.monitor_slug, MONITORS[MAIN]);
  assert.deepEqual(open.items[0].payload.monitor_config, close.items[0].payload.monitor_config);
  assert.notEqual(checkInId(MONITORS[MAIN], '1', '1'), checkInId(MONITORS[MAIN], '1', '2'));
  assert.equal(open.items[0].payload.check_in_id, checkInId(MONITORS[MAIN], '43116268679', '1'));
  assert.match(open.items[0].payload.check_in_id, /^[0-9a-f]{32}$/);
});

test('start workflow does not check in on the main slug', () => {
  const plan = buildPlan(env({
    GITHUB_WORKFLOW: START,
    CRON_CHECKIN_PHASE: 'open',
  }));
  assert.equal(plan.items[0].payload.monitor_slug, MONITORS[START]);
  assert.equal(plan.items[0].payload.monitor_slug.endsWith('-start'), true);
});

test('skipped deploy is an ok check-in and a failed job reports error', () => {
  assert.equal(terminalStatus('success', 'skipped'), 'ok');
  assert.equal(terminalStatus('success', 'success'), 'ok');
  assert.equal(terminalStatus('cancelled', 'skipped'), 'ok');
  assert.equal(terminalStatus('success', 'cancelled'), 'ok');
  assert.equal(terminalStatus('failure', 'skipped'), 'error');
  assert.equal(terminalStatus('success', 'failure'), 'error');
  assert.equal(terminalStatus('failure', 'failure'), 'error');
  assert.equal(terminalStatus('', ''), 'error');

  const ok = buildPlan(env({ TEST_RESULT: 'success', DEPLOY_RESULT: 'skipped' }));
  assert.deepEqual(ok.items.map((item) => item.type), ['check_in']);
  assert.equal(ok.items[0].payload.status, 'ok');

  const failed = buildPlan(env({ TEST_RESULT: 'failure', DEPLOY_RESULT: 'skipped' }));
  assert.deepEqual(failed.items.map((item) => item.type), ['event', 'check_in']);
  assert.equal(failed.items[1].payload.status, 'error');
  assert.equal(failed.items[0].payload.fingerprint[0], 'ci-failure');
  assert.equal(failed.items[0].payload.fingerprint[1], APP);
  assert.equal(failed.items[0].payload.fingerprint[2], MAIN);
  assert.equal(failed.items[0].payload.environment, 'fleet-ci');
  assert.equal(failed.items[1].payload.check_in_id, ok.items[0].payload.check_in_id);
});

test('non-schedule success sends nothing and a non-schedule failure sends only the event', () => {
  const quiet = buildPlan(env({ GITHUB_EVENT_NAME: 'workflow_run' }));
  assert.equal(quiet.items.length, 0);
  const broken = buildPlan(env({ GITHUB_EVENT_NAME: 'workflow_run', TEST_RESULT: 'failure' }));
  assert.deepEqual(broken.items.map((item) => item.type), ['event']);
  const pull = buildPlan(env({ GITHUB_EVENT_NAME: 'pull_request', TEST_RESULT: 'failure' }));
  assert.equal(pull.items.length, 0);
  const opened = buildPlan(env({ GITHUB_EVENT_NAME: 'workflow_dispatch', CRON_CHECKIN_PHASE: 'open' }));
  assert.equal(opened.items.length, 0);
});

test('open without a run id does not leave an uncloseable check-in', () => {
  const plan = buildPlan(env({ CRON_CHECKIN_PHASE: 'open', GITHUB_RUN_ID: '' }));
  assert.equal(plan.items.length, 0);
  assert.ok(plan.warnings.some((line) => line.includes('GITHUB_RUN_ID')));
});

test('envelope and DSN handling never echo the DSN', async () => {
  const dsn = 'https://example-public-key@example.ingest.sentry.io/12345';
  assert.deepEqual(parseDsn(dsn), {
    publicKey: 'example-public-key',
    host: 'example.ingest.sentry.io',
    projectId: '12345',
  });
  assert.equal(parseDsn('not-a-dsn'), null);

  const item = buildPlan(env({ CRON_CHECKIN_PHASE: 'open' })).items[0];
  const body = envelopeBody(item);
  assert.equal(body.includes(dsn), false);
  assert.equal(body.includes('example-public-key'), false);
  assert.match(body, /"monitor_slug":"ci-personal-site-vercel-production-catch-up"/);
  assert.match(body, /"type":"interval"/);

  const calls = [];
  const logs = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  console.log = (...args) => logs.push(args.join(' '));
  console.warn = (...args) => logs.push(args.join(' '));
  console.error = (...args) => logs.push(args.join(' '));
  try {
    const missing = await main(env({ CRON_CHECKIN_PHASE: 'open', SENTRY_FLEET_DSN: '' }), async () => {
      calls.push('posted');
    });
    assert.equal(missing, 0);
    assert.equal(calls.length, 0);

    const bad = await main(env({ CRON_CHECKIN_PHASE: 'open', SENTRY_FLEET_DSN: 'not-a-dsn' }), async () => {
      calls.push('posted');
    });
    assert.equal(bad, 0);
    assert.equal(calls.length, 0);

    const posted = await main(env({ CRON_CHECKIN_PHASE: 'open', SENTRY_FLEET_DSN: dsn }), async (target, sent) => {
      calls.push({ url: target.url, auth: target.auth, type: sent.type, slug: sent.payload.monitor_slug });
      throw new TypeError('network down');
    });
    assert.equal(posted, 0);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://example.ingest.sentry.io/api/12345/envelope/');
    assert.equal(calls[0].slug, MONITORS[MAIN]);
    assert.equal(calls[0].auth.includes('example-public-key'), true);
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
  const joined = logs.join('\n');
  assert.equal(joined.includes(dsn), false);
  assert.equal(joined.includes('example-public-key'), false);
  assert.match(joined, /HTTP|failed: TypeError|not set|not in the expected/);
});
